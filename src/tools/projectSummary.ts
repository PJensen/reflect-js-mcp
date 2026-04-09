import type { RepoInventory } from "../core/repo.js";
import type { ReflectConfig } from "../types/config.js";
import type { SymbolIndex } from "../core/symbolIndex.js";
import type { MemoryCache } from "../cache/memoryCache.js";
import { getPackageName } from "../core/repo.js";
import { toolResult, type ToolResponse } from "../types/tool.js";

export function handleProjectSummary(
  inventory: RepoInventory,
  config: ReflectConfig,
  symbolIndex: SymbolIndex,
  cache: MemoryCache,
): ToolResponse {
  return toolResult({
    projectName: getPackageName(config.root) ?? "(unknown)",
    root: config.root,
    totalFiles: inventory.files.length,
    filesByExtension: inventory.filesByExt,
    indexedSymbols: symbolIndex.size,
    cacheStats: cache.stats(),
    lastScanTime: new Date(inventory.lastScanTime).toISOString(),
    watchMode: config.watch,
  });
}
