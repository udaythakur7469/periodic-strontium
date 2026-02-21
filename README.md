# ⚡ Periodic Strontium

[![npm version](https://img.shields.io/npm/v/@periodic/strontium.svg)](https://www.npmjs.com/package/@periodic/strontium)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

**Production-grade, reliability-first HTTP client with resilience primitives for Node.js with TypeScript support**

Part of the **Periodic** series of Node.js packages by Uday Thakur.

---

## 💡 Why Strontium?

**Strontium** gets its name from the chemical element renowned for its reactivity and its role as a signal amplifier — strontium compounds produce the brilliant crimson flame used in flares and emergency signals precisely because they cut through noise and make failures impossible to ignore. Just like strontium turns a flame into a clear warning signal, this library **turns silent HTTP failures into structured, recoverable events** — before they cascade into outages.

In materials science, strontium is used to refine grain structure in aluminium alloys, making the metal more resilient under stress. Similarly, **@periodic/strontium** refines the structure of every HTTP request your backend makes — adding retry logic, circuit breaking, deduplication, and timeout control so that network stress doesn't propagate into your application.

The name represents:
- **Resilience**: Retries, circuit breaking, and timeouts built into every request
- **Clarity**: Every request follows a deterministic, inspectable state machine
- **Protection**: Failures are caught, classified, and handled — never silently swallowed
- **Precision**: Idempotency key enforcement and payload hashing prevent silent data corruption

Just as strontium makes critical systems more visible and more robust under pressure, **@periodic/strontium** makes your HTTP layer the most reliable part of your stack.

---

## 🎯 Why Choose Strontium?

Building robust backends means making HTTP calls that can fail — and most HTTP clients give you no help when they do:

- **Vanilla `fetch`** has no retry logic, no circuit breaking, and no timeout by default
- **Manual retry wrappers** are inconsistent, miss edge cases, and scatter logic across your codebase
- **No deduplication** means concurrent identical requests hammer your upstream services
- **No circuit breaker** means a degraded downstream takes your whole app down with it
- **No idempotency enforcement** means retried POST requests can silently duplicate charges or records
- **No schema validation** means API drift reaches your business logic before you notice

**Periodic Strontium** provides the perfect solution:

✅ **Zero hard dependencies** — Pluggable transport, peer deps only for optional features  
✅ **Edge-compatible** — Node 18+, browsers, Cloudflare Workers, Deno, and Bun  
✅ **Deterministic State Machine** — Every request follows a strict, inspectable lifecycle  
✅ **Retry Engine** — Fixed, linear, or exponential backoff with jitter  
✅ **Circuit Breaker** — CLOSED/OPEN/HALF_OPEN with configurable thresholds  
✅ **Request Deduplication** — In-flight identical requests share a single promise  
✅ **Timeout Control** — Hard timeouts via `AbortController` on every request  
✅ **Schema Validation** — Pluggable validator support (Zod, Yup, and more)  
✅ **Payload Integrity** — SHA-256 body hashing with idempotency key enforcement  
✅ **Lifecycle Hooks** — Observable at every stage without mutating request flow  
✅ **OpenTelemetry** — Optional span propagation via peer dependency  
✅ **Type-safe** — Strict TypeScript, zero `any`, from the ground up  
✅ **No global state** — No side effects on import  
✅ **Production-ready** — Non-blocking, never crashes your app

---

## 📦 Installation

```bash
npm install @periodic/strontium
```

Or with yarn:

```bash
yarn add @periodic/strontium
```

**Optional peer dependencies** (install only what you need):

```bash
npm install @opentelemetry/api  # For OpenTelemetry span propagation
npm install zod                 # For Zod schema validation
```

---

## 🚀 Quick Start

```typescript
import { createStrontiumClient } from '@periodic/strontium';

// 1. Create a client
const client = createStrontiumClient({
  baseURL: 'https://api.example.com',
  timeoutMs: 8000,
  retry: {
    enabled: true,
    maxAttempts: 3,
    strategy: 'exponential',
    baseDelayMs: 100,
    maxDelayMs: 5000,
    jitter: true,
    retryOn: ['network', '5xx'],
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    halfOpenMaxCalls: 1,
  },
});

// 2. Make requests — retries, timeouts, and circuit breaking are automatic
const res = await client.request<{ id: string; name: string }>({
  method: 'GET',
  url: '/users/123',
});

console.log(res.data); // { id: '123', name: 'Alice' }
```

**Example error output:**

```json
{
  "type": "RetryExhaustedError",
  "message": "Request failed after 3 attempts",
  "url": "/users/123",
  "attempts": 3,
  "lastStatus": 503,
  "durationMs": 4821
}
```

---

## 🧠 Core Concepts

### The `createStrontiumClient` Function

- **`createStrontiumClient` is the primary factory function**
- Returns a configured client instance
- Accepts flexible configuration for retry, circuit breaking, timeouts, and more
- **This is the main entry point for all HTTP calls**
- No global state, safe for multi-tenant apps and multiple service targets

**Typical usage:**
- Application code creates one client per upstream service with `createStrontiumClient()`
- All requests through the client automatically get retry, timeout, and circuit breaking
- Lifecycle hooks and `client.health()` give full observability into every request
- Schema validation catches API drift before it reaches your business logic

```typescript
const client = createStrontiumClient({
  baseURL: 'https://api.example.com',
  timeoutMs: 8000,
  retry: { enabled: true, maxAttempts: 3, strategy: 'exponential' },
  circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 30_000 },
});
```

### The Deterministic State Machine

- **Every request transitions through explicit, inspectable states**
- Illegal transitions throw `DeterministicStateError` — no silent failures
- The circuit breaker sits outside the lifecycle and rejects requests fast when downstream services degrade
- Deduplication coalesces concurrent identical requests before they hit the network

**Design principle:**
> Every request has a state. Every state has a valid set of transitions. Nothing happens outside the machine.

```
IDLE → PENDING → SUCCESS
              → ERROR
              → RETRYING → PENDING (loop)
              → CANCELLED
```

---

## ✨ Features

### 🔄 Retry Engine

Fixed, linear, or exponential backoff — with jitter to prevent thundering herd:

```typescript
const client = createStrontiumClient({
  baseURL: 'https://api.example.com',
  retry: {
    enabled: true,
    maxAttempts: 3,
    strategy: 'exponential', // 'fixed' | 'linear' | 'exponential'
    baseDelayMs: 100,
    maxDelayMs: 5000,
    jitter: true,
    retryOn: ['network', '5xx'], // retry conditions
  },
});
```

### 🛡️ Circuit Breaker

Prevent cascade failures when a downstream service is degraded:

```typescript
const client = createStrontiumClient({
  baseURL: 'https://api.example.com',
  circuitBreaker: {
    failureThreshold: 5,     // open after 5 consecutive failures
    resetTimeoutMs: 30_000,  // probe again after 30s
    halfOpenMaxCalls: 1,     // allow 1 probe call in HALF_OPEN
  },
});
```

**States:** `CLOSED` (normal) → `OPEN` (fast-fail) → `HALF_OPEN` (one probe) → `CLOSED`

### 🔁 Request Deduplication

Concurrent identical GET/HEAD requests share a single in-flight promise — your upstream services see one request, not ten:

```typescript
const client = createStrontiumClient({
  baseURL: 'https://api.example.com',
  dedupe: true, // default
});

// These three calls resolve from a single network request
const [a, b, c] = await Promise.all([
  client.request({ method: 'GET', url: '/users/1' }),
  client.request({ method: 'GET', url: '/users/1' }),
  client.request({ method: 'GET', url: '/users/1' }),
]);
```

### ⏱️ Timeout Control

Hard timeouts on every request via `AbortController` — no more requests that hang forever:

```typescript
// Global timeout
const client = createStrontiumClient({ baseURL: '...', timeoutMs: 8000 });

// Per-request override
const res = await client.request({
  method: 'GET',
  url: '/slow-endpoint',
  timeoutMs: 2000, // overrides client default
});
```

### 🔐 Idempotent Mode

Automatically inject `Idempotency-Key` and `X-Payload-Hash` headers — and enforce integrity so retried requests can never silently change their payload:

```typescript
const client = createStrontiumClient({
  baseURL: 'https://api.example.com',
  protocolMode: 'idempotent',
});

await client.request({
  method: 'POST',
  url: '/payments',
  body: { amount: 100, currency: 'USD' },
  idempotencyKey: 'payment-abc-123',
});
// Automatically adds:
// Idempotency-Key: payment-abc-123
// X-Payload-Hash: sha256-...

// Same key + different payload → IntegrityViolationError ❌
```

### ✅ Schema Validation

Validate response shape with any pluggable validator — catch API drift before it reaches your business logic:

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

const res = await client.request({
  method: 'GET',
  url: '/users/1',
  schema: UserSchema,
});

// res.data is fully typed as z.infer<typeof UserSchema>
// ResponseValidationError thrown if shape doesn't match
```

### 🪝 Lifecycle Hooks

Hook into request events for observability without mutating request flow:

```typescript
client.use({
  onBeforeRequest: (ctx) => logger.info('request.start', { url: ctx.url }),
  onAfterResponse: (ctx, res) => logger.info('request.complete', { url: ctx.url, status: res.status }),
  onRetry: (ctx, err) => logger.warn('request.retry', { url: ctx.url, error: err.message }),
  onCircuitOpen: (ctx) => sendToSlack(`⚠️ Circuit open for ${ctx.url}`),
  onError: (ctx, err) => Sentry.captureException(err, { extra: ctx }),
  onCancel: (ctx) => logger.info('request.cancelled', { url: ctx.url }),
});
```

### 📊 Health Inspection

Expose client health via your health check endpoint:

```typescript
const { circuitState, recentFailures, averageLatency } = client.health();

// circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
// recentFailures: number
// averageLatency: number (ms)
```

### 📡 OpenTelemetry

Optional span propagation — no hard SDK dependency:

```typescript
import { trace } from '@opentelemetry/api';

const client = createStrontiumClient({
  baseURL: 'https://api.example.com',
  tracer: trace.getTracer('my-service'),
});
```

---

## 📚 Common Patterns

### 1. Basic Service Client

```typescript
import { createStrontiumClient } from '@periodic/strontium';

const userService = createStrontiumClient({
  baseURL: process.env.USER_SERVICE_URL,
  timeoutMs: 5000,
  retry: { enabled: true, maxAttempts: 3, strategy: 'exponential' },
});

const res = await userService.request<User>({ method: 'GET', url: `/users/${id}` });
```

### 2. Payment Service with Idempotency

```typescript
const paymentClient = createStrontiumClient({
  baseURL: process.env.PAYMENT_SERVICE_URL,
  protocolMode: 'idempotent',
  timeoutMs: 10_000,
  retry: {
    enabled: true,
    maxAttempts: 3,
    strategy: 'exponential',
    retryOn: ['network', '5xx'],
  },
});

const charge = await paymentClient.request({
  method: 'POST',
  url: '/charges',
  body: { amount: 100, currency: 'USD' },
  idempotencyKey: `charge:${orderId}`,
});
```

### 3. With Zod Schema Validation

```typescript
import { z } from 'zod';

const OrderSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'fulfilled', 'cancelled']),
  total: z.number(),
});

const res = await client.request({
  method: 'GET',
  url: `/orders/${orderId}`,
  schema: OrderSchema,
});

// res.data is typed as z.infer<typeof OrderSchema>
```

### 4. Cancellable Request

```typescript
const controller = new AbortController();

// Cancel after 2 seconds
setTimeout(() => controller.abort(), 2000);

const res = await client.request({
  method: 'GET',
  url: '/long-running',
  signal: controller.signal,
});
```

### 5. Severity-Based Error Routing

```typescript
import {
  NetworkError,
  TimeoutError,
  RetryExhaustedError,
  CircuitOpenError,
} from '@periodic/strontium';

try {
  await client.request({ method: 'GET', url: '/data' });
} catch (err) {
  if (err instanceof CircuitOpenError) sendToPagerDuty(err);
  else if (err instanceof RetryExhaustedError) sendToSlack(err);
  else if (err instanceof TimeoutError) logger.warn('timeout', err);
  else if (err instanceof NetworkError) logger.error('network', err);
}
```

### 6. Health Check Integration

```typescript
app.get('/health', (req, res) => {
  const health = client.health();
  const status = health.circuitState === 'OPEN' ? 503 : 200;
  res.status(status).json(health);
});
```

### 7. Structured Logging Integration

```typescript
import { createLogger, ConsoleTransport, JsonFormatter } from '@periodic/iridium';

const logger = createLogger({
  transports: [new ConsoleTransport({ formatter: new JsonFormatter() })],
});

client.use({
  onBeforeRequest: (ctx) => logger.info('strontium.request', { url: ctx.url }),
  onAfterResponse: (ctx, res) => logger.info('strontium.response', { url: ctx.url, status: res.status }),
  onError: (ctx, err) => logger.error('strontium.error', { url: ctx.url, error: err.message }),
});
```

### 8. Production Configuration

```typescript
import { createStrontiumClient } from '@periodic/strontium';
import { trace } from '@opentelemetry/api';

const isDevelopment = process.env.NODE_ENV === 'development';

export const apiClient = createStrontiumClient({
  baseURL: process.env.API_BASE_URL,
  timeoutMs: isDevelopment ? 30_000 : 8_000,
  retry: {
    enabled: true,
    maxAttempts: isDevelopment ? 1 : 3,
    strategy: 'exponential',
    baseDelayMs: 100,
    maxDelayMs: 5_000,
    jitter: true,
    retryOn: ['network', '5xx'],
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeoutMs: 30_000,
    halfOpenMaxCalls: 1,
  },
  dedupe: true,
  protocolMode: 'standard',
  tracer: isDevelopment ? undefined : trace.getTracer('my-service'),
  headers: {
    'X-Service-Name': 'my-service',
    'X-Service-Version': process.env.APP_VERSION ?? '0.0.0',
  },
});

export default apiClient;
```

---

## 🎛️ Configuration Options

### `createStrontiumClient` Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseURL` | `string` | — | Base URL prepended to all requests |
| `timeoutMs` | `number` | `30000` | Request timeout in milliseconds |
| `retry` | `Partial<RetryConfig>` | See below | Retry configuration |
| `circuitBreaker` | `Partial<CircuitBreakerConfig>` | See below | Circuit breaker configuration |
| `dedupe` | `boolean` | `true` | Deduplicate in-flight GET/HEAD requests |
| `protocolMode` | `'standard' \| 'idempotent'` | `'standard'` | Inject idempotency and hash headers |
| `mode` | `'strict' \| 'performance'` | `'strict'` | Schema validation and instrumentation level |
| `transport` | `Transport` | `fetch` | Custom transport function |
| `tracer` | `OTelTracer` | — | Optional OpenTelemetry tracer |
| `headers` | `Record<string, string>` | `{}` | Default headers for all requests |

### `RetryConfig` Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable retry logic |
| `maxAttempts` | `number` | `3` | Maximum retry attempts |
| `strategy` | `'fixed' \| 'linear' \| 'exponential'` | `'exponential'` | Backoff strategy |
| `baseDelayMs` | `number` | `100` | Base delay between retries |
| `maxDelayMs` | `number` | `5000` | Maximum delay cap |
| `jitter` | `boolean` | `true` | Add randomness to delay |
| `retryOn` | `RetryCondition[]` | `['network', '5xx']` | Conditions that trigger retry |

### `CircuitBreakerConfig` Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `failureThreshold` | `number` | `5` | Consecutive failures before OPEN |
| `resetTimeoutMs` | `number` | `30_000` | Time in OPEN before HALF_OPEN probe |
| `halfOpenMaxCalls` | `number` | `1` | Max probe calls in HALF_OPEN state |

### `client.request` Options

| Option | Type | Description |
|--------|------|-------------|
| `method` | `HttpMethod` | HTTP method |
| `url` | `string` | URL (relative or absolute) |
| `body` | `unknown` | Request body (JSON serialized) |
| `headers` | `Record<string, string>` | Per-request headers |
| `schema` | `Validator<T>` | Response validator |
| `idempotencyKey` | `string` | Idempotency key (auto-generated in idempotent mode) |
| `timeoutMs` | `number` | Per-request timeout override |
| `signal` | `AbortSignal` | Cancellation signal |

---

## 📋 API Reference

### Client

```typescript
createStrontiumClient(config: StrontiumConfig): StrontiumClient
client.request<T>(options: RequestOptions): Promise<Response<T>>
client.use(hooks: EventHooks): void
client.health(): HealthStatus
```

### Hooks

```typescript
client.use({
  onBeforeRequest: (ctx) => void,
  onAfterResponse: (ctx, res) => void,
  onRetry: (ctx, err) => void,
  onCircuitOpen: (ctx) => void,
  onError: (ctx, err) => void,
  onCancel: (ctx) => void,
});
```

### Error Types

```typescript
import {
  NetworkError,
  TimeoutError,
  RetryExhaustedError,
  CircuitOpenError,
  ResponseValidationError,
  IntegrityViolationError,
  DeterministicStateError,
} from '@periodic/strontium';
```

### Types

```typescript
import type {
  StrontiumConfig,
  RetryConfig,
  CircuitBreakerConfig,
  RequestOptions,
  EventHooks,
  HealthStatus,
  Transport,
  HttpMethod,
} from '@periodic/strontium';
```

---

## 🧩 Architecture

```
@periodic/strontium/
├── src/
│   ├── core/                  # Framework-agnostic client engine
│   │   ├── client.ts         # Main StrontiumClient class + createStrontiumClient()
│   │   ├── stateMachine.ts   # Deterministic request state machine
│   │   ├── retry.ts          # Retry engine (fixed, linear, exponential + jitter)
│   │   ├── circuitBreaker.ts # Circuit breaker (CLOSED/OPEN/HALF_OPEN)
│   │   ├── dedupe.ts         # In-flight request deduplication
│   │   └── timeout.ts        # AbortController timeout management
│   ├── integrity/             # Idempotency and payload hashing
│   │   ├── hash.ts           # SHA-256 body hashing
│   │   └── idempotency.ts    # Key generation and integrity enforcement
│   ├── validation/            # Pluggable schema validation
│   │   └── index.ts          # Validator interface + error wrapping
│   ├── hooks/                 # Lifecycle hook system
│   │   └── index.ts          # Hook registry and dispatch
│   ├── otel/                  # OpenTelemetry span propagation
│   │   └── index.ts          # Graceful no-op if tracer not configured
│   ├── errors/                # Typed error classes
│   │   └── index.ts          # All error types + type guards
│   ├── types.ts               # TypeScript interfaces
│   └── index.ts               # Public API
```

**Design Philosophy:**
- **Core** is pure TypeScript with no dependencies
- **State machine** is the single source of truth for every request's lifecycle
- **Circuit breaker** sits outside the request — it gates entry, not execution
- **Hooks** are observer-only — they can never affect request outcome
- **Transport** is pluggable — swap `fetch` for any custom implementation
- Easy to extend with custom retry conditions and transport layers

---

## 📈 Performance

Strontium is optimized for production workloads:

- **Deduplication** — concurrent identical requests hit the network only once
- **Jitter** — prevents thundering herd on retry storms
- **AbortController** — timeouts release resources immediately, no zombie requests
- **Hook isolation** — hook errors are silently swallowed, never affect request flow
- **No global state** — multiple clients in the same process are fully isolated
- **No monkey-patching** — clean wrapping only, no prototype mutation

---

## 🚫 Explicit Non-Goals

This package **intentionally does not** include:

❌ Request caching (use `@periodic/osmium` for that)  
❌ Rate limiting (use `@periodic/titanium` for that)  
❌ HTTP server functionality — this is a client library  
❌ Vendor-specific lock-in of any kind  
❌ Cookie jar or session management  
❌ Automatic response body transformation beyond JSON  
❌ Blocking behavior in production  
❌ Magic or implicit behavior on import  
❌ Configuration files (configure in code)

Focus on doing one thing well: **resilient, deterministic, production-safe HTTP requests**.

---

## 🎨 TypeScript Support

Full TypeScript support with complete type safety:

```typescript
import type {
  StrontiumConfig,
  RetryConfig,
  CircuitBreakerConfig,
  RequestOptions,
  EventHooks,
  HealthStatus,
} from '@periodic/strontium';

// Fully generic — type inference works automatically
const res = await client.request<User>({ method: 'GET', url: '/users/1' });
res.data; // typed as User

// With schema validation
const res = await client.request({ method: 'GET', url: '/users/1', schema: UserSchema });
res.data; // typed as z.infer<typeof UserSchema>
```

---

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

**Note:** All tests achieve >80% code coverage.

---

## 🤝 Related Packages

Part of the **Periodic** series by Uday Thakur:

- [**@periodic/iridium**](https://www.npmjs.com/package/@periodic/iridium) - Structured logging
- [**@periodic/arsenic**](https://www.npmjs.com/package/@periodic/arsenic) - Semantic runtime monitoring
- [**@periodic/zirconium**](https://www.npmjs.com/package/@periodic/zirconium) - Environment configuration
- [**@periodic/vanadium**](https://www.npmjs.com/package/@periodic/vanadium) - Idempotency and distributed locks
- [**@periodic/obsidian**](https://www.npmjs.com/package/@periodic/obsidian) - HTTP error handling
- [**@periodic/titanium**](https://www.npmjs.com/package/@periodic/titanium) - Rate limiting
- [**@periodic/osmium**](https://www.npmjs.com/package/@periodic/osmium) - Redis caching

Build complete, production-ready APIs with the Periodic series!

---

## 📖 Documentation

- [Quick Start Guide](QUICKSTART.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

---

## 🛠️ Production Recommendations

### Environment Variables

```bash
NODE_ENV=production
API_BASE_URL=https://api.example.com
APP_VERSION=1.0.0
```

### Log Aggregation

Pair with `@periodic/iridium` for structured JSON output:

```typescript
import { createLogger, ConsoleTransport, JsonFormatter } from '@periodic/iridium';
import { createStrontiumClient } from '@periodic/strontium';

const logger = createLogger({
  transports: [new ConsoleTransport({ formatter: new JsonFormatter() })],
});

const client = createStrontiumClient({ baseURL: process.env.API_BASE_URL });

client.use({
  onAfterResponse: (ctx, res) => logger.info('http.response', { url: ctx.url, status: res.status }),
  onError: (ctx, err) => logger.error('http.error', { url: ctx.url, error: err.message }),
  onRetry: (ctx, err) => logger.warn('http.retry', { url: ctx.url, error: err.message }),
});

// Pipe to Elasticsearch, Datadog, CloudWatch, etc.
```

### Error Monitoring

Integrate with error tracking:

```typescript
import { CircuitOpenError, RetryExhaustedError } from '@periodic/strontium';

client.use({
  onError: (ctx, err) => {
    if (err instanceof CircuitOpenError || err instanceof RetryExhaustedError) {
      Sentry.captureException(err, { extra: { url: ctx.url } });
    }
  },
});
```

---

## 📝 License

MIT © [Uday Thakur](LICENSE)

---

## 🙏 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on:

- Code of conduct
- Development setup
- Pull request process
- Coding standards
- Architecture principles

---

## 📞 Support

- 📧 **Email:** udaythakurwork@gmail.com
- 🐛 **Issues:** [GitHub Issues](https://github.com/udaythakur7469/periodic-strontium/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/udaythakur7469/periodic-strontium/discussions)

---

## 🌟 Show Your Support

Give a ⭐️ if this project helped you build better applications!

---

**Built with ❤️ by Uday Thakur for production-grade Node.js applications**