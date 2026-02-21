import { createStrontiumClient } from '@periodic/strontium';

const client = createStrontiumClient({
  baseURL: 'https://api.example.com',
  timeoutMs: 8000,
  dedupe: true,
  protocolMode: 'idempotent',
  mode: 'strict',
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

// Add lifecycle hooks
client.use({
  onBeforeRequest: (ctx) => {
    console.log(`[${ctx.requestId}] → ${ctx.method} ${ctx.url}`);
  },
  onAfterResponse: (ctx, res) => {
    console.log(`[${ctx.requestId}] ← ${res.status} in ${res.latencyMs}ms`);
  },
  onRetry: (ctx, err) => {
    console.warn(`[${ctx.requestId}] Retry #${ctx.attempt}`, err);
  },
  onCircuitOpen: (ctx) => {
    console.error(`[${ctx.requestId}] Circuit OPEN — request rejected`);
  },
  onError: (ctx, err) => {
    console.error(`[${ctx.requestId}] Error:`, err);
  },
});

// Simple GET request
async function getUser(id: string) {
  const res = await client.request<{ id: string; name: string }>({
    method: 'GET',
    url: `/users/${id}`,
  });
  return res.data;
}

// POST with idempotency
async function createOrder(payload: { item: string; qty: number }) {
  const res = await client.request<{ orderId: string }>({
    method: 'POST',
    url: '/orders',
    body: payload,
    idempotencyKey: `order-${Date.now()}`,
  });
  return res.data;
}

// Health check
function checkHealth() {
  const health = client.health();
  console.log('Circuit:', health.circuitState);
  console.log('Avg latency:', health.averageLatency.toFixed(2), 'ms');
}

(async () => {
  const user = await getUser('123');
  console.log('User:', user);

  const order = await createOrder({ item: 'widget', qty: 2 });
  console.log('Order:', order.orderId);

  checkHealth();
})();
