import { CircuitOpenError } from '../core/errors.js';
import type { CircuitBreakerConfig, CircuitState } from '../core/types.js';

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  halfOpenMaxCalls: 1,
};

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private halfOpenCalls = 0;
  private lastOpenedAt = 0;
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }

  check(): void {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastOpenedAt;
      if (elapsed >= this.config.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.halfOpenCalls = 0;
      } else {
        throw new CircuitOpenError();
      }
    }

    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        throw new CircuitOpenError();
      }
      this.halfOpenCalls++;
    }
  }

  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failures = 0;
    } else if (this.state === 'CLOSED') {
      this.failures = 0;
    }
  }

  recordFailure(): void {
    this.failures++;
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.lastOpenedAt = Date.now();
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
      this.lastOpenedAt = Date.now();
    }
  }
}
