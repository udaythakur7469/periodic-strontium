import type { Hooks, HookContext, StrontiumResponse } from '../core/types.js';

export async function runHook<Args extends unknown[]>(
  fn: ((...args: Args) => void | Promise<void>) | undefined,
  ...args: Args
): Promise<void> {
  if (!fn) return;
  try {
    await fn(...args);
  } catch {
    // hooks must never crash the client
  }
}

export type { Hooks, HookContext };

export function createHookRunner(hooks: Hooks) {
  return {
    beforeRequest: (ctx: HookContext) => runHook(hooks.onBeforeRequest, ctx),
    afterResponse: (ctx: HookContext, res: StrontiumResponse<unknown>) =>
      runHook(hooks.onAfterResponse, ctx, res),
    onRetry: (ctx: HookContext, err: unknown) => runHook(hooks.onRetry, ctx, err),
    onCircuitOpen: (ctx: HookContext) => runHook(hooks.onCircuitOpen, ctx),
    onError: (ctx: HookContext, err: unknown) => runHook(hooks.onError, ctx, err),
    onCancel: (ctx: HookContext) => runHook(hooks.onCancel, ctx),
  };
}
