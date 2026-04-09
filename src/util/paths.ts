import path from "node:path";

export function normalizePath(filePath: string, root: string): string {
  const resolved = path.resolve(root, filePath);
  return path.relative(root, resolved);
}

export function assertInsideRoot(filePath: string, root: string): string {
  const resolved = path.resolve(root, filePath);
  const rel = path.relative(root, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new PathEscapeError(filePath, root);
  }
  return rel;
}

export function toAbsolute(filePath: string, root: string): string {
  return path.resolve(root, filePath);
}

export class PathEscapeError extends Error {
  code = "PATH_OUTSIDE_ROOT" as const;
  constructor(filePath: string, root: string) {
    super(`Path "${filePath}" resolves outside repo root "${root}"`);
  }
}
