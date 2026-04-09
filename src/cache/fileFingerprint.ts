import fs from "node:fs";
import { contentHash } from "../util/hashing.js";

export interface FileFingerprint {
  mtime: number;
  size: number;
  hash: string;
}

export function getFileFingerprint(absPath: string): FileFingerprint | null {
  try {
    const stat = fs.statSync(absPath);
    const content = fs.readFileSync(absPath, "utf-8");
    return {
      mtime: stat.mtimeMs,
      size: stat.size,
      hash: contentHash(content),
    };
  } catch {
    return null;
  }
}

export function fingerprintString(fp: FileFingerprint): string {
  return `${fp.hash}:${fp.size}`;
}
