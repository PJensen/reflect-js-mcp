import type { ReflectConfig } from "../types/config.js";
import type { MemoryCache } from "../cache/memoryCache.js";
import type { SymbolIndex } from "../core/symbolIndex.js";
import { assertInsideRoot } from "../util/paths.js";
import { fileExists, readFileContent } from "../core/repo.js";
import { analyzeClosures } from "../core/moduleSummary.js";
import { toolResult, toolError, type ToolResponse } from "../types/tool.js";

export function handleClosureCaptures(
  config: ReflectConfig,
  cache: MemoryCache,
  symbolIndex: SymbolIndex,
  args: { filePath: string; functionName?: string },
): ToolResponse {
  try {
    const rel = assertInsideRoot(args.filePath, config.root);
    if (!fileExists(rel, config.root)) {
      return toolError("FILE_NOT_FOUND", `No file found at ${args.filePath}`, { filePath: args.filePath });
    }

    const source = readFileContent(rel, config.root);
    const results = analyzeClosures(source, rel, config, args.functionName);

    return toolResult({
      filePath: rel,
      functions: results,
    });
  } catch (err) {
    if ((err as { code?: string }).code === "PATH_OUTSIDE_ROOT") {
      return toolError("PATH_OUTSIDE_ROOT", (err as Error).message);
    }
    throw err;
  }
}
