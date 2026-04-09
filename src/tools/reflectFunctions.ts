import type { ReflectConfig } from "../types/config.js";
import type { MemoryCache } from "../cache/memoryCache.js";
import type { SymbolIndex } from "../core/symbolIndex.js";
import { getOrParseModule } from "./reflectModule.js";
import { assertInsideRoot } from "../util/paths.js";
import { fileExists } from "../core/repo.js";
import { toolResult, toolError, type ToolResponse } from "../types/tool.js";

export function handleReflectFunctions(
  config: ReflectConfig,
  cache: MemoryCache,
  symbolIndex: SymbolIndex,
  args: { filePath: string; nameFilter?: string },
): ToolResponse {
  try {
    const rel = assertInsideRoot(args.filePath, config.root);
    if (!fileExists(rel, config.root)) {
      return toolError("FILE_NOT_FOUND", `No file found at ${args.filePath}`, { filePath: args.filePath });
    }

    const summary = getOrParseModule(rel, config, cache, symbolIndex);
    let functions = summary.functions;

    if (args.nameFilter) {
      const filter = args.nameFilter.toLowerCase();
      functions = functions.filter((f) => f.name.toLowerCase().includes(filter));
    }

    return toolResult({
      filePath: rel,
      functions,
      classes: summary.classes,
    });
  } catch (err) {
    if ((err as { code?: string }).code === "PATH_OUTSIDE_ROOT") {
      return toolError("PATH_OUTSIDE_ROOT", (err as Error).message);
    }
    throw err;
  }
}
