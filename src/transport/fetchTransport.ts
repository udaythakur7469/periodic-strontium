import type { Transport } from '../core/types.js';
export const defaultTransport: Transport = (request: Request) => fetch(request);
