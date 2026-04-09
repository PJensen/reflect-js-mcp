import type { ReflectConfig } from "../types/config.js";
import type { MemoryCache } from "../cache/memoryCache.js";
import type { SymbolIndex } from "../core/symbolIndex.js";
import type { RepoInventory } from "../core/repo.js";
import { scanRepo } from "../core/repo.js";
import { CacheInvalidator } from "../cache/invalidation.js";
import { toAbsolute } from "../util/paths.js";
import { ensureParsed } from "./moduleGraph.js";
import { toolResult, type ToolResponse } from "../types/tool.js";

export async function handleRefreshIndex(
  config: ReflectConfig,
  cache: MemoryCache,
  symbolIndex: SymbolIndex,
  currentInventory: RepoInventory,
  args: { pathScope?: string },
): Promise<{ response: ToolResponse; inventory: RepoInventory }> {
  const invalidator = new CacheInvalidator(cache);

  // Re-scan repo
  const newInventory = await scanRepo(config);

  // Check for invalidated files
  let invalidatedCount = 0;
  for (const file of newInventory.files) {
    if (args.pathScope && !file.startsWith(args.pathScope)) continue;
    const abs = toAbsolute(file, config.root);
    if (invalidator.checkAndInvalidate(abs)) {
      invalidatedCount++;
    }
  }

  // Re-parse scoped files
  const summaries = ensureParsed(newInventory, config, cache, symbolIndex, args.pathScope);
  let parseFailures = 0;
  for (const s of summaries.values()) {
    if (s.parseErrors.length > 0) parseFailures++;
  }

  const response = toolResult({
    totalFiles: newInventory.files.length,
    refreshedScope: args.pathScope ?? "(all)",
    invalidatedEntries: invalidatedCount,
    parsedFiles: summaries.size,
    parseFailures,
    lastScanTime: new Date(newInventory.lastScanTime).toISOString(),
  });

  return { response, inventory: newInventory };
}
