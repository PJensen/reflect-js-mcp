import type { ModuleSummary } from "../types/module.js";

interface CacheEntry<T> {
  value: T;
  fingerprint: string;
  timestamp: number;
}

export class MemoryCache {
  private modules = new Map<string, CacheEntry<ModuleSummary>>();
  private misc = new Map<string, CacheEntry<unknown>>();

  getModule(filePath: string, fingerprint: string): ModuleSummary | null {
    const entry = this.modules.get(filePath);
    if (entry && entry.fingerprint === fingerprint) return entry.value;
    return null;
  }

  setModule(filePath: string, fingerprint: string, summary: ModuleSummary): void {
    this.modules.set(filePath, { value: summary, fingerprint, timestamp: Date.now() });
  }

  get<T>(key: string, fingerprint: string): T | null {
    const entry = this.misc.get(key);
    if (entry && entry.fingerprint === fingerprint) return entry.value as T;
    return null;
  }

  set<T>(key: string, fingerprint: string, value: T): void {
    this.misc.set(key, { value, fingerprint, timestamp: Date.now() });
  }

  invalidate(filePath: string): void {
    this.modules.delete(filePath);
    for (const key of this.misc.keys()) {
      if (key.startsWith(filePath)) this.misc.delete(key);
    }
  }

  clear(): void {
    this.modules.clear();
    this.misc.clear();
  }

  stats(): { modulesCached: number; miscCached: number } {
    return { modulesCached: this.modules.size, miscCached: this.misc.size };
  }
}
