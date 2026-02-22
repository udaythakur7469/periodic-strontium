export class StrontiumError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'StrontiumError';
  }
}

export class NetworkError extends StrontiumError {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends StrontiumError {
  constructor(public readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
  }
}

export class RetryExhaustedError extends StrontiumError {
  constructor(
    public readonly attempts: number,
    public readonly lastError: unknown,
  ) {
    super(`Retry exhausted after ${attempts} attempts`, 'RETRY_EXHAUSTED');
    this.name = 'RetryExhaustedError';
  }
}

export class CircuitOpenError extends StrontiumError {
  constructor() {
    super('Circuit breaker is OPEN. Request rejected.', 'CIRCUIT_OPEN');
    this.name = 'CircuitOpenError';
  }
}

export class ResponseValidationError extends StrontiumError {
  constructor(
    message: string,
    public readonly validationErrors?: unknown,
  ) {
    super(message, 'RESPONSE_VALIDATION_ERROR');
    this.name = 'ResponseValidationError';
  }
}

export class IntegrityViolationError extends StrontiumError {
  constructor(message: string) {
    super(message, 'INTEGRITY_VIOLATION');
    this.name = 'IntegrityViolationError';
  }
}

export class DeterministicStateError extends StrontiumError {
  constructor(from: string, to: string) {
    super(`Illegal state transition: ${from} → ${to}`, 'DETERMINISTIC_STATE_ERROR');
    this.name = 'DeterministicStateError';
  }
}
