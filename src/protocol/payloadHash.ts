import { IntegrityViolationError } from '../core/errors.js';

// Use SubtleCrypto if available (browser/edge/node18+), fallback to simple hash
async function sha256(data: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Node.js fallback using require
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createHash } = require('crypto') as typeof import('crypto');
  return createHash('sha256').update(data).digest('hex');
}

export async function computePayloadHash(body: unknown): Promise<string> {
  const serialized = body === undefined ? '' : JSON.stringify(body);
  return sha256(serialized);
}

const idempotencyKeyHashes = new Map<string, string>();

export async function enforceIntegrity(idempotencyKey: string, body: unknown): Promise<string> {
  const hash = await computePayloadHash(body);
  const existing = idempotencyKeyHashes.get(idempotencyKey);
  if (existing !== undefined && existing !== hash) {
    throw new IntegrityViolationError(
      `Idempotency key "${idempotencyKey}" was already used with a different payload.`,
    );
  }
  idempotencyKeyHashes.set(idempotencyKey, hash);
  return hash;
}

export function computeDedupeKey(method: string, url: string, bodyHash: string): string {
  return `${method}:${url}:${bodyHash}`;
}
