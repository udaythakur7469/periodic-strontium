export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function generateIdempotencyKey(): string {
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function headersToRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}
