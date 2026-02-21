const MAX_DEDUPE_MAP_SIZE = 1000;

export class DedupeMap {
  private map = new Map<string, Promise<unknown>>();

  get(key: string): Promise<unknown> | undefined {
    return this.map.get(key);
  }

  set(key: string, promise: Promise<unknown>): void {
    if (this.map.size >= MAX_DEDUPE_MAP_SIZE) {
      const firstKey = this.map.keys().next().value;
      if (firstKey) this.map.delete(firstKey);
    }
    this.map.set(key, promise);
    promise.then(
      () => this.map.delete(key),
      () => this.map.delete(key),
    );
  }

  size(): number {
    return this.map.size;
  }
}
