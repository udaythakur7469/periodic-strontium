# Changelog

All notable changes to `@periodic/strontium` will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2024-01-01

### Added
- Initial release of `@periodic/strontium`
- Deterministic state machine (IDLE, PENDING, RETRYING, SUCCESS, ERROR, CANCELLED)
- Retry engine with fixed, linear, exponential strategies and jitter
- Circuit breaker (CLOSED, OPEN, HALF_OPEN) with configurable thresholds
- Request deduplication for GET/HEAD requests
- Timeout control via AbortController
- Pluggable schema validation
- Payload integrity enforcement with SHA-256 hashing
- Idempotency key injection in idempotent protocol mode
- Event hooks: onBeforeRequest, onAfterResponse, onRetry, onCircuitOpen, onError, onCancel
- Optional OpenTelemetry span propagation
- Pluggable transport layer
- Health monitoring via `client.health()`
- Strict and performance execution modes
- Full TypeScript support with strict types
- ESM + CommonJS dual exports
- Edge runtime compatibility (Node 18+, browsers, Workers, Bun, Deno)
- Comprehensive test suite
