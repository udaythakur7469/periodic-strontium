import { TimeoutError } from '../core/errors.js';

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  controller: AbortController,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (err) => {
        clearTimeout(timeoutId);
        reject(err);
      },
    );
  });
}

export function createAbortController(): AbortController {
  return new AbortController();
}
