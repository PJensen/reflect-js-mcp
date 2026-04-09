import type { ReflectConfig } from "../types/config.js";
import type { MemoryCache } from "../cache/memoryCache.js";
import type { SymbolIndex } from "../core/symbolIndex.js";
import { assertInsideRoot } from "../util/paths.js";
import { fileExists, readFileContent } from "../core/repo.js";
import { summarizeModule } from "../core/moduleSummary.js";
import { getFileFingerprint, fingerprintString } from "../cache/fileFingerprint.js";
import { toAbsolute } from "../util/paths.js";
import { toolResult, toolError, type ToolResponse } from "../types/tool.js";

export function handleReflectModule(
  config: ReflectConfig,
  cache: MemoryCache,
  symbolIndex: SymbolIndex,
  args: { filePath: string },
): ToolResponse {
  try {
    const rel = assertInsideRoot(args.filePath, config.root);
    if (!fileExists(rel, config.root)) {
      return toolError("FILE_NOT_FOUND", `No file found at ${args.filePath}`, { filePath: args.filePath });
    }

    const summary = getOrParseModule(rel, config, cache, symbolIndex);
    return toolResult(summary);
  } catch (err) {
    if ((err as { code?: string }).code === "PATH_OUTSIDE_ROOT") {
      return toolError("PATH_OUTSIDE_ROOT", (err as Error).message);
    }
    throw err;
  }
}

export function getOrParseModule(
  relPath: string,
  config: ReflectConfig,
  cache: MemoryCache,
  symbolIndex: SymbolIndex,
) {
  const abs = toAbsolute(relPath, config.root);
  const fp = getFileFingerprint(abs);
  if (!fp) throw new Error(`Cannot read file: ${relPath}`);

  const fpStr = fingerprintString(fp);
  const cached = cache.getModule(relPath, fpStr);
  if (cached) return cached;

  const source = readFileContent(relPath, config.root);
  const summary = summarizeModule(source, relPath, config);

  cache.setModule(relPath, fpStr, summary);
  symbolIndex.indexModule(summary);

  return summary;
}
