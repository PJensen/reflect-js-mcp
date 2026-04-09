import type { ReflectConfig } from "../types/config.js";
import type { MemoryCache } from "../cache/memoryCache.js";
import type { SymbolIndex } from "../core/symbolIndex.js";
import { getOrParseModule } from "./reflectModule.js";
import { buildCallGraph } from "../core/callGraph.js";
import { assertInsideRoot } from "../util/paths.js";
import { fileExists } from "../core/repo.js";
import { toolResult, toolError, type ToolResponse } from "../types/tool.js";

export function handleCallGraph(
  config: ReflectConfig,
  cache: MemoryCache,
  symbolIndex: SymbolIndex,
  args: { filePath: string; symbol?: string; depth?: number; limit?: number },
): ToolResponse {
  try {
    const rel = assertInsideRoot(args.filePath, config.root);
    if (!fileExists(rel, config.root)) {
      return toolError("FILE_NOT_FOUND", `No file found at ${args.filePath}`, { filePath: args.filePath });
    }

    const summary = getOrParseModule(rel, config, cache, symbolIndex);
    const result = buildCallGraph(summary, args.symbol, {
      maxNodes: Math.min(args.limit ?? config.bounds.maxGraphNodes, config.bounds.maxGraphNodes),
      maxEdges: config.bounds.maxGraphEdges,
    });

    return toolResult({
      ...result,
      note: "Static hint graph — may not reflect runtime behavior accurately.",
    });
  } catch (err) {
    if ((err as { code?: string }).code === "PATH_OUTSIDE_ROOT") {
      return toolError("PATH_OUTSIDE_ROOT", (err as Error).message);
    }
    throw err;
  }
}
