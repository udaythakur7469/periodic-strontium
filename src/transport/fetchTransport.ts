import type { Transport } from '../core/types.js';
export const defaultTransport: Transport = (url: string, init: RequestInit) => fetch(url, init);
