import { createStrontiumClient } from '../src/index';
import {
  NetworkError,
  CircuitOpenError,
  RetryExhaustedError,
  DeterministicStateError,
  ResponseValidationError,
} from '../src/core/errors';
import { StateMachine } from '../src/core/stateMachine';
import { CircuitBreaker } from '../src/resilience/circuitBreaker';
import { DedupeMap } from '../src/resilience/dedupe';

// Mock fetch globally
global.fetch = jest.fn();

function mockFetch(status: number, data: unknown, delay = 0): void {
  (global.fetch as jest.Mock).mockImplementation(async () => {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => data,
      text: async () => String(data),
    };
  });
}


beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── State Machine ────────────────────────────────────────────────────────────
describe('StateMachine', () => {
  it('starts in IDLE', () => {
    const sm = new StateMachine();
    expect(sm.getState()).toBe('IDLE');
  });

  it('transitions IDLE → PENDING', () => {
    const sm = new StateMachine();
    sm.transition('PENDING');
    expect(sm.getState()).toBe('PENDING');
  });

  it('throws DeterministicStateError on illegal transition', () => {
    const sm = new StateMachine();
    expect(() => sm.transition('SUCCESS')).toThrow(DeterministicStateError);
  });

  it('marks terminal states correctly', () => {
    const sm = new StateMachine();
    sm.transition('PENDING');
    sm.transition('SUCCESS');
    expect(sm.isTerminal()).toBe(true);
  });
});

// ─── Circuit Breaker ──────────────────────────────────────────────────────────
describe('CircuitBreaker', () => {
  it('starts CLOSED', () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe('CLOSED');
  });

  it('opens after failureThreshold', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 60000, halfOpenMaxCalls: 1 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');
  });

  it('throws CircuitOpenError when OPEN', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60000, halfOpenMaxCalls: 1 });
    cb.recordFailure();
    expect(() => cb.check()).toThrow(CircuitOpenError);
  });

  it('transitions to HALF_OPEN after resetTimeout', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 10, halfOpenMaxCalls: 1 });
    cb.recordFailure();
    await new Promise((r) => setTimeout(r, 20));
    expect(() => cb.check()).not.toThrow();
    expect(cb.getState()).toBe('HALF_OPEN');
  });

  it('closes after success in HALF_OPEN', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 10, halfOpenMaxCalls: 1 });
    cb.recordFailure();
    await new Promise((r) => setTimeout(r, 20));
    cb.check(); // transitions to HALF_OPEN
    cb.recordSuccess();
    expect(cb.getState()).toBe('CLOSED');
  });
});

// ─── Deduplication ────────────────────────────────────────────────────────────
describe('DedupeMap', () => {
  it('returns same promise for same key', () => {
    const map = new DedupeMap();
    const p = Promise.resolve('test');
    map.set('key1', p);
    expect(map.get('key1')).toBe(p);
  });

  it('cleans up after promise resolves', async () => {
    const map = new DedupeMap();
    const p = Promise.resolve('done');
    map.set('key1', p);
    await p;
    await new Promise((r) => setImmediate(r));
    expect(map.get('key1')).toBeUndefined();
  });
});

// ─── Client: Successful Request ───────────────────────────────────────────────
describe('StrontiumClient.request()', () => {

  it('retries on 500 and succeeds', async () => {
    let calls = 0;
    (global.fetch as jest.Mock).mockImplementation(async () => {
      calls++;
      if (calls < 2) {
        return {
          ok: false,
          status: 500,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({}),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ ok: true }),
      };
    });

    const client = createStrontiumClient({
      baseURL: 'https://api.example.com',
      retry: { maxAttempts: 3, baseDelayMs: 1, strategy: 'fixed', jitter: false },
    });

    const res = await client.request({ method: 'GET', url: '/retry' });
    expect(res.status).toBe(200);
    expect(calls).toBe(2);
  });

  it('throws RetryExhaustedError after all attempts fail', async () => {
    mockFetch(503, {});
    const client = createStrontiumClient({
      baseURL: 'https://api.example.com',
      retry: { maxAttempts: 2, baseDelayMs: 1, jitter: false },
    });
    await expect(client.request({ method: 'GET', url: '/fail' })).rejects.toThrow(
      RetryExhaustedError,
    );
  });


  it('returns data on 200', async () => {
    mockFetch(200, { id: '1', name: 'Alice' });
    const client = createStrontiumClient({ baseURL: 'https://api.example.com' });
    const res = await client.request({ method: 'GET', url: '/users/1' });
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ id: '1', name: 'Alice' });
    expect(res.requestId).toBeTruthy();
  });

  it('throws NetworkError on 500 with no retry config', async () => {
    mockFetch(500, { error: 'server error' });
    const client = createStrontiumClient({
      baseURL: 'https://api.example.com',
      retry: { maxAttempts: 1 },
    });
    await expect(client.request({ method: 'GET', url: '/fail' })).rejects.toThrow(NetworkError);
  });

  it('validates response schema in strict mode', async () => {
    mockFetch(200, { wrong: 'shape' });
    const schema = {
      parse: (data: unknown) => {
        const d = data as { id?: string };
        if (!d.id) throw new Error('missing id');
        return d;
      },
    };
    const client = createStrontiumClient({
      baseURL: 'https://api.example.com',
      mode: 'strict',
    });
    await expect(client.request({ method: 'GET', url: '/user', schema })).rejects.toThrow(ResponseValidationError);
  });

  it('skips schema validation in performance mode', async () => {
    mockFetch(200, { wrong: 'shape' });
    const schema = { parse: () => { throw new Error('should not be called'); } };
    const client = createStrontiumClient({
      baseURL: 'https://api.example.com',
      mode: 'performance',
    });
    const res = await client.request({ method: 'GET', url: '/user', schema });
    expect(res.status).toBe(200);
  });

  it('reports health status', () => {
    const client = createStrontiumClient({ baseURL: 'https://api.example.com' });
    const health = client.health();
    expect(health.circuitState).toBe('CLOSED');
    expect(health.recentFailures).toBe(0);
    expect(typeof health.averageLatency).toBe('number');
  });

  it('fires hooks without crashing on hook error', async () => {
    mockFetch(200, { ok: true });
    const client = createStrontiumClient({ baseURL: 'https://api.example.com' });
    client.use({
      onBeforeRequest: () => { throw new Error('hook error'); },
    });
    const res = await client.request({ method: 'GET', url: '/ok' });
    expect(res.status).toBe(200);
  });
});
