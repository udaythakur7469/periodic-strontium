import type { OTelSpan, OTelTracer } from '../core/types.js';

export interface MetricsSample {
  requestId: string;
  url: string;
  method: string;
  latencyMs: number;
  attempt: number;
  status: number | null;
  success: boolean;
}

export class Metrics {
  private samples: MetricsSample[] = [];
  private readonly maxSamples = 1000;

  record(sample: MetricsSample): void {
    if (this.samples.length >= this.maxSamples) {
      this.samples.shift();
    }
    this.samples.push(sample);
  }

  averageLatency(): number {
    if (this.samples.length === 0) return 0;
    const sum = this.samples.reduce((acc, s) => acc + s.latencyMs, 0);
    return sum / this.samples.length;
  }

  recentFailures(windowMs = 60000): number {
    const cutoff = Date.now() - windowMs;
    return this.samples.filter((s) => !s.success && Date.now() - s.latencyMs > cutoff).length;
  }
}

export function startSpan(tracer: OTelTracer | undefined, name: string): OTelSpan | undefined {
  if (!tracer) return undefined;
  try {
    return tracer.startSpan(name);
  } catch {
    return undefined;
  }
}

export function endSpan(
  span: OTelSpan | undefined,
  attrs: Record<string, string | number | boolean>,
): void {
  if (!span) return;
  try {
    for (const [k, v] of Object.entries(attrs)) {
      span.setAttribute(k, v);
    }
    span.end();
  } catch {
    // never crash on instrumentation
  }
}
