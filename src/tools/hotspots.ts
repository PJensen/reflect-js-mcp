import type { ReflectConfig } from "../types/config.js";
import type { MemoryCache } from "../cache/memoryCache.js";
import type { SymbolIndex } from "../core/symbolIndex.js";
import type { RepoInventory } from "../core/repo.js";
import { ensureParsed } from "./moduleGraph.js";
import { rankHotspots } from "../core/hotspotRanker.js";
import { toolResult, type ToolResponse } from "../types/tool.js";

export function handleHotspots(
  config: ReflectConfig,
  cache: MemoryCache,
  symbolIndex: SymbolIndex,
  inventory: RepoInventory,
  args: { pathScope?: string; limit?: number },
): ToolResponse {
  const summaries = ensureParsed(inventory, config, cache, symbolIndex, args.pathScope);
  const result = rankHotspots(summaries, {
    pathScope: args.pathScope,
    limit: args.limit ?? 20,
  });

  return toolResult(result);
}
