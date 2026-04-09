import fg from "fast-glob";
import path from "node:path";
import fs from "node:fs";
import type { ReflectConfig } from "../types/config.js";

export interface RepoInventory {
  root: string;
  files: string[];
  filesByExt: Record<string, number>;
  lastScanTime: number;
}

export async function scanRepo(config: ReflectConfig): Promise<RepoInventory> {
  const files = await fg(config.include, {
    cwd: config.root,
    ignore: config.exclude,
    dot: false,
    onlyFiles: true,
    absolute: false,
  });

  files.sort();

  const filesByExt: Record<string, number> = {};
  for (const f of files) {
    const ext = path.extname(f) || "(none)";
    filesByExt[ext] = (filesByExt[ext] ?? 0) + 1;
  }

  return {
    root: config.root,
    files,
    filesByExt,
    lastScanTime: Date.now(),
  };
}

export function readFileContent(filePath: string, root: string): string {
  const abs = path.resolve(root, filePath);
  return fs.readFileSync(abs, "utf-8");
}

export function fileExists(filePath: string, root: string): boolean {
  const abs = path.resolve(root, filePath);
  return fs.existsSync(abs);
}

export function getPackageName(root: string): string | null {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(root, "package.json"), "utf-8"));
    return pkg.name ?? null;
  } catch {
    return null;
  }
}
