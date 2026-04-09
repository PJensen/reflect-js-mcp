import type { ReflectConfig } from "../types/config.js";
import type { MemoryCache } from "../cache/memoryCache.js";
import type { SymbolIndex } from "../core/symbolIndex.js";
import type { RepoInventory } from "../core/repo.js";
import { ensureParsed } from "./moduleGraph.js";
import { architecturalSlice } from "../core/subsystemInference.js";
import { toolResult, toolError, type ToolResponse } from "../types/tool.js";

export function handleArchitecturalSlice(
  config: ReflectConfig,
  cache: MemoryCache,
  symbolIndex: SymbolIndex,
  inventory: RepoInventory,
  args: { query: string; pathScope?: string; limit?: number },
): ToolResponse {
  if (!args.query || args.query.trim() === "") {
    return toolError("INVALID_INPUT", "query is required");
  }

  const summaries = ensureParsed(inventory, config, cache, symbolIndex, args.pathScope);
  const result = architecturalSlice(args.query, summaries, config, {
    pathScope: args.pathScope,
    limit: args.limit ?? 20,
  });

  return toolResult(result);
}
