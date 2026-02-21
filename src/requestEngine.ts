import { StateMachine } from './core/stateMachine.js';
import {
  NetworkError,
  TimeoutError,
  RetryExhaustedError,
  ResponseValidationError,
} from './core/errors.js';
import type {
  StrontiumClientConfig,
  RequestOptions,
  StrontiumResponse,
  HealthStatus,
  Hooks,
  RetryConfig,
} from './core/types.js';
import { DEFAULT_RETRY_CONFIG, shouldRetry, backoff } from './resilience/retry.js';
import { CircuitBreaker } from './resilience/circuitBreaker.js';
import { withTimeout, createAbortController } from './resilience/timeout.js';
import { DedupeMap } from './resilience/dedupe.js';
import { generateRequestId, generateIdempotencyKey, headersToRecord } from './protocol/headers.js';
import { computePayloadHash, enforceIntegrity, computeDedupeKey } from './protocol/payloadHash.js';
import { Metrics, startSpan, endSpan } from './observability/instrumentation.js';
import { createHookRunner } from './hooks/lifecycle.js';
import { defaultTransport } from './transport/fetchTransport.js';

const MAX_CONCURRENT_REQUESTS = 100;

export class StrontiumClient {
  private readonly config: Required<StrontiumClientConfig>;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly dedupeMap: DedupeMap;
  private readonly metrics: Metrics;
  private readonly retryConfig: RetryConfig;
  private inFlight = 0;
  private hooks: Hooks = {};

  constructor(config: StrontiumClientConfig) {
    this.config = {
      baseURL: config.baseURL,
      retry: { ...DEFAULT_RETRY_CONFIG, ...config.retry },
      circuitBreaker: config.circuitBreaker ?? {},
      timeoutMs: config.timeoutMs ?? 30000,
      dedupe: config.dedupe ?? true,
      protocolMode: config.protocolMode ?? 'standard',
      mode: config.mode ?? 'strict',
      transport: config.transport ?? defaultTransport,
      tracer: config.tracer ?? undefined,
      headers: config.headers ?? {},
    } as Required<StrontiumClientConfig>;

    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...config.retry,
      retryOn: config.retry?.retryOn ?? DEFAULT_RETRY_CONFIG.retryOn,
    };
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    this.dedupeMap = new DedupeMap();
    this.metrics = new Metrics();
  }

  use(hooks: Hooks): this {
    this.hooks = { ...this.hooks, ...hooks };
    return this;
  }

  async request<T = unknown>(options: RequestOptions): Promise<StrontiumResponse<T>> {
    const { method, url, body, headers = {}, schema, timeoutMs } = options;
    const fullUrl = url.startsWith('http') ? url : `${this.config.baseURL}${url}`;
    const requestId = generateRequestId();
    const effectiveTimeout = timeoutMs ?? this.config.timeoutMs;

    // Dedupe
    if (
      this.config.dedupe &&
      (method === 'GET' || method === 'HEAD') &&
      this.retryConfig.maxAttempts <= 1
    ) {
      const bodyHash = await computePayloadHash(body);
      const dedupeKey = computeDedupeKey(method, fullUrl, bodyHash);
      const existing = this.dedupeMap.get(dedupeKey);
      if (existing) {
        return existing as Promise<StrontiumResponse<T>>;
      }
      const promise = this._executeWithRetry<T>(
        requestId,
        method,
        fullUrl,
        body,
        headers,
        schema,
        effectiveTimeout,
        options,
      );
      this.dedupeMap.set(dedupeKey, promise as Promise<unknown>);
      return promise;
    }

    return this._executeWithRetry<T>(requestId, method, fullUrl, body, headers, schema, effectiveTimeout, options);
  }

  private async _executeWithRetry<T>(
    requestId: string,
    method: string,
    url: string,
    body: unknown,
    headers: Record<string, string>,
    schema: RequestOptions['schema'],
    timeoutMs: number,
    options: RequestOptions,
  ): Promise<StrontiumResponse<T>> {
    const machine = new StateMachine();
    const hookRunner = createHookRunner(this.hooks);
    const ctx = { method, url, attempt: 0, requestId };

    machine.transition('PENDING');

    let lastError: unknown;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      ctx.attempt = attempt;

      if (this.inFlight >= MAX_CONCURRENT_REQUESTS) {
        throw new NetworkError('Max concurrent requests exceeded');
      }

      try {
        this.circuitBreaker.check();
      } catch (err) {
        await hookRunner.onCircuitOpen(ctx);
        machine.transition('ERROR');
        throw err;
      }

      await hookRunner.beforeRequest(ctx);

      const controller = createAbortController();
      if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort());
      }

      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
        ...this.config.headers,
        ...headers,
      };

      if (this.config.protocolMode === 'idempotent') {
        const idemKey = options.idempotencyKey ?? generateIdempotencyKey();
        requestHeaders['Idempotency-Key'] = idemKey;
        if (body !== undefined) {
          const hash = await enforceIntegrity(idemKey, body);
          requestHeaders['X-Payload-Hash'] = hash;
        }
      }

      const hasBody = body !== undefined && method !== 'GET' && method !== 'HEAD';

      const span = startSpan(this.config.tracer, 'strontium.request');
      const startTime = Date.now();
      this.inFlight++;

      let response: Response;
      let statusCode: number | null = null;

      try {
        response = await withTimeout(
          fetch(url, {
            method,
            headers: requestHeaders,
            ...(hasBody ? { body: JSON.stringify(body) } : {}),
            signal: controller.signal,
          }),
          timeoutMs,
          controller,
        );

        statusCode = response.status;
        const latencyMs = Date.now() - startTime;
        this.inFlight--;

        if (!response.ok) {
          this.circuitBreaker.recordFailure();
          lastError = new NetworkError(`HTTP ${statusCode}`);
          if (
            shouldRetry(this.retryConfig, null, statusCode, attempt) &&
            attempt < this.retryConfig.maxAttempts
          ) {
            machine.transition('RETRYING');
            await hookRunner.onRetry(ctx, lastError);
            await backoff(this.retryConfig, attempt);
            machine.transition('PENDING');
            continue;
          }
          break;
        }

        let data: unknown;
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }
        if (schema && this.config.mode === 'strict') {
          let validationError: ResponseValidationError | null = null;
          try {
            data = schema.parse(data);
          } catch (err) {
            validationError = new ResponseValidationError('Response validation failed', err);
          }
          if (validationError) {
            machine.transition('ERROR');
            await hookRunner.onError(ctx, validationError);
            throw validationError;
          }
        }

        this.circuitBreaker.recordSuccess();
        machine.transition('SUCCESS');

        const result: StrontiumResponse<T> = {
          data: data as T,
          status: statusCode,
          headers: headersToRecord(response.headers),
          requestId,
          attempt,
          latencyMs,
        };

        this.metrics.record({
          requestId,
          url,
          method,
          latencyMs,
          attempt,
          status: statusCode,
          success: true,
        });
        endSpan(span, {
          'http.status': statusCode,
          'request.id': requestId,
          'retry.attempt': attempt,
        });
        await hookRunner.afterResponse(ctx, result as StrontiumResponse<unknown>);
        return result;
      } catch (err) {
        if (err instanceof ResponseValidationError) throw err;
        this.inFlight--;
        const latencyMs = Date.now() - startTime;

        if (err instanceof TimeoutError || (err instanceof Error && err.name === 'AbortError')) {
          const timeoutError = err instanceof TimeoutError ? err : new TimeoutError(timeoutMs);
          lastError = timeoutError;

          if (options.signal?.aborted) {
            machine.transition('CANCELLED');
            await hookRunner.onCancel(ctx);
            throw timeoutError;
          }

          this.circuitBreaker.recordFailure();
          this.metrics.record({
            requestId,
            url,
            method,
            latencyMs,
            attempt,
            status: null,
            success: false,
          });
          if (
            shouldRetry(this.retryConfig, timeoutError, null, attempt) &&
            attempt < this.retryConfig.maxAttempts
          ) {
            machine.transition('RETRYING');
            await hookRunner.onRetry(ctx, timeoutError);
            await backoff(this.retryConfig, attempt);
            machine.transition('PENDING');
            continue;
          }

          machine.transition('ERROR');
          throw timeoutError;
        }

        if (machine.getState() !== 'ERROR' && machine.getState() !== 'CANCELLED') {
          const isNetworkErr = err instanceof TypeError;
          lastError = err;

          this.circuitBreaker.recordFailure();
          this.metrics.record({
            requestId,
            url,
            method,
            latencyMs,
            attempt,
            status: statusCode,
            success: false,
          });
          if (
            isNetworkErr &&
            shouldRetry(this.retryConfig, err, null, attempt) &&
            attempt < this.retryConfig.maxAttempts
          ) {
            machine.transition('RETRYING');
            await hookRunner.onRetry(ctx, err);
            await backoff(this.retryConfig, attempt);
            machine.transition('PENDING');
            continue;
          }

          machine.transition('ERROR');
          await hookRunner.onError(ctx, err);
          endSpan(span, { 'request.id': requestId, 'retry.attempt': attempt });
        }

        throw err;
      }
    }

    machine.transition('ERROR');
    if (this.retryConfig.maxAttempts <= 1) {
      throw lastError ?? new NetworkError('Request failed');
    }
    throw new RetryExhaustedError(this.retryConfig.maxAttempts, lastError);
  }

  health(): HealthStatus {
    return {
      circuitState: this.circuitBreaker.getState(),
      recentFailures: this.circuitBreaker.getFailures(),
      averageLatency: this.metrics.averageLatency(),
    };
  }
}

export function createStrontiumClient(config: StrontiumClientConfig): StrontiumClient {
  return new StrontiumClient(config);
}
