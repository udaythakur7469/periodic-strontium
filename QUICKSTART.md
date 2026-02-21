# Quick Start

## 1. Install

```bash
npm install @periodic/strontium
```

## 2. Create a client

```typescript
import { createStrontiumClient } from '@periodic/strontium';

const client = createStrontiumClient({
  baseURL: 'https://api.example.com',
  timeoutMs: 5000,
});
```

## 3. Make requests

```typescript
const res = await client.request<{ id: string; name: string }>({
  method: 'GET',
  url: '/users/1',
});

console.log(res.data.name); // 'Alice'
```

## 4. Add resilience

```typescript
const client = createStrontiumClient({
  baseURL: 'https://api.example.com',
  retry: { maxAttempts: 3, strategy: 'exponential', jitter: true },
  circuitBreaker: { failureThreshold: 5 },
});
```

## 5. Handle errors

```typescript
import { NetworkError, TimeoutError, CircuitOpenError } from '@periodic/strontium';

try {
  const res = await client.request({ method: 'GET', url: '/data' });
} catch (err) {
  if (err instanceof CircuitOpenError) {
    console.warn('Service degraded — circuit is open');
  } else if (err instanceof TimeoutError) {
    console.warn('Request timed out');
  }
}
```
