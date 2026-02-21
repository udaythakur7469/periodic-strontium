export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type RetryStrategy = 'fixed' | 'exponential' | 'linear' | ((attempt: number, baseDelayMs: number) => number);

export interface RetryConfig {
  enabled: boolean;
  maxAttempts: number;
  strategy: RetryStrategy;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
  retryOn: Array<'network' | '5xx' | number>;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxCalls: number;
}

export type ProtocolMode = 'standard' | 'idempotent';
export type ClientMode = 'strict' | 'performance';

export interface StrontiumClientConfig {
  baseURL: string;
  retry?: Partial<RetryConfig>;
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  timeoutMs?: number;
  dedupe?: boolean;
  protocolMode?: ProtocolMode;
  mode?: ClientMode;
  transport?: Transport;
  tracer?: OTelTracer;
  headers?: Record<string, string>;
}

export interface RequestOptions<TBody = unknown> {
  method: HttpMethod;
  url: string;
  body?: TBody;
  headers?: Record<string, string>;
  schema?: Validator<unknown>;
  signal?: AbortSignal;
  idempotencyKey?: string;
  timeoutMs?: number;
}

export interface StrontiumResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  requestId: string;
  attempt: number;
  latencyMs: number;
}

export interface Validator<T> {
  parse(data: unknown): T;
}

export type Transport = (request: Request) => Promise<Response>;

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface HealthStatus {
  circuitState: CircuitState;
  recentFailures: number;
  averageLatency: number;
}

export interface HookContext {
  method: string;
  url: string;
  attempt: number;
  requestId: string;
}

export interface Hooks {
  onBeforeRequest?: (ctx: HookContext) => void | Promise<void>;
  onAfterResponse?: (ctx: HookContext, response: StrontiumResponse<unknown>) => void | Promise<void>;
  onRetry?: (ctx: HookContext, error: unknown) => void | Promise<void>;
  onCircuitOpen?: (ctx: HookContext) => void | Promise<void>;
  onError?: (ctx: HookContext, error: unknown) => void | Promise<void>;
  onCancel?: (ctx: HookContext) => void | Promise<void>;
}

// Minimal OTel interface to avoid hard dependency
export interface OTelSpan {
  setAttribute(key: string, value: string | number | boolean): void;
  end(): void;
  recordException(error: unknown): void;
  setStatus(status: { code: number }): void;
}

export interface OTelTracer {
  startSpan(name: string): OTelSpan;
}
