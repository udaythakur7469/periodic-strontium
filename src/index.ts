export { createStrontiumClient, StrontiumClient } from './requestEngine.js';

// Core types
export type {
  StrontiumClientConfig,
  RequestOptions,
  StrontiumResponse,
  RetryConfig,
  RetryStrategy,
  CircuitBreakerConfig,
  ProtocolMode,
  ClientMode,
  HttpMethod,
  Validator,
  Transport,
  HealthStatus,
  CircuitState,
  Hooks,
  HookContext,
  OTelTracer,
  OTelSpan,
} from './core/types.js';

// Errors
export {
  StrontiumError,
  NetworkError,
  TimeoutError,
  RetryExhaustedError,
  CircuitOpenError,
  ResponseValidationError,
  IntegrityViolationError,
  DeterministicStateError,
} from './core/errors.js';

// State machine
export { StateMachine } from './core/stateMachine.js';
export type { RequestState } from './core/stateMachine.js';

// Resilience primitives (for advanced usage)
export { CircuitBreaker } from './resilience/circuitBreaker.js';
export { shouldRetry, backoff } from './resilience/retry.js';

// Protocol utilities
export { generateRequestId, generateIdempotencyKey } from './protocol/headers.js';
export { computePayloadHash } from './protocol/payloadHash.js';
