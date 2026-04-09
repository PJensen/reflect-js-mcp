import { MemoryCache } from "./memoryCache.js";
import { getFileFingerprint, fingerprintString, type FileFingerprint } from "./fileFingerprint.js";

export class CacheInvalidator {
  private fingerprints = new Map<string, FileFingerprint>();

  constructor(private cache: MemoryCache) {}

  record(absPath: string, fp: FileFingerprint): void {
    this.fingerprints.set(absPath, fp);
  }

  checkAndInvalidate(absPath: string): boolean {
    const old = this.fingerprints.get(absPath);
    const current = getFileFingerprint(absPath);

    if (!current) {
      if (old) {
        this.cache.invalidate(absPath);
        this.fingerprints.delete(absPath);
        return true;
      }
      return false;
    }

    if (!old || fingerprintString(old) !== fingerprintString(current)) {
      this.cache.invalidate(absPath);
      this.fingerprints.set(absPath, current);
      return true;
    }

    return false;
  }

  invalidateAll(): void {
    this.cache.clear();
    this.fingerprints.clear();
  }
}
