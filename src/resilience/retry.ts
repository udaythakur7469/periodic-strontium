import type { RetryConfig, RetryStrategy } from '../core/types.js';

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  enabled: true,
  maxAttempts: 3,
  strategy: 'exponential',
  baseDelayMs: 100,
  maxDelayMs: 30000,
  jitter: true,
  retryOn: ['network', '5xx'],
};

function computeDelay(
  strategy: RetryStrategy,
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitter: boolean,
): number {
  let delay: number;
  if (typeof strategy === 'function') {
    delay = strategy(attempt, baseDelayMs);
  } else if (strategy === 'fixed') {
    delay = baseDelayMs;
  } else if (strategy === 'linear') {
    delay = baseDelayMs * attempt;
  } else {
    // exponential
    delay = baseDelayMs * Math.pow(2, attempt - 1);
  }

  delay = Math.min(delay, maxDelayMs);
  if (jitter) {
    delay = delay * (0.5 + Math.random() * 0.5);
  }
  return Math.floor(delay);
}

export function shouldRetry(
  config: RetryConfig,
  _error: unknown,
  statusCode: number | null,
  attempt: number,
): boolean {
  if (!config.enabled) return false;
  if (attempt >= config.maxAttempts) return false;

  for (const condition of config.retryOn) {
    if (condition === 'network' && statusCode === null) return true;
    if (condition === '5xx' && statusCode !== null && statusCode >= 500) return true;
    if (typeof condition === 'number' && statusCode === condition) return true;
  }

  return false;
}

export async function backoff(config: RetryConfig, attempt: number): Promise<void> {
  const delay = computeDelay(
    config.strategy,
    attempt,
    config.baseDelayMs,
    config.maxDelayMs,
    config.jitter,
  );
  await new Promise((resolve) => setTimeout(resolve, delay));
}
