import type { ReflectConfig } from "../types/config.js";
import type { MemoryCache } from "../cache/memoryCache.js";
import type { SymbolIndex } from "../core/symbolIndex.js";
import type { RepoInventory } from "../core/repo.js";
import type { ModuleSummary } from "../types/module.js";
import { getOrParseModule } from "./reflectModule.js";
import { buildModuleGraph } from "../core/callGraph.js";
import { assertInsideRoot } from "../util/paths.js";
import { toolResult, toolError, type ToolResponse } from "../types/tool.js";

export function handleModuleGraph(
  config: ReflectConfig,
  cache: MemoryCache,
  symbolIndex: SymbolIndex,
  inventory: RepoInventory,
  args: { filePath?: string; pathPrefix?: string; depth?: number; direction?: "inbound" | "outbound" | "both"; limit?: number },
): ToolResponse {
  const center = args.filePath ?? args.pathPrefix;
  if (!center) {
    return toolError("INVALID_INPUT", "filePath or pathPrefix is required");
  }

  try {
    if (args.filePath) assertInsideRoot(args.filePath, config.root);
  } catch (err) {
    return toolError("PATH_OUTSIDE_ROOT", (err as Error).message);
  }

  // Parse all relevant files to build graph
  const summaries = ensureParsed(inventory, config, cache, symbolIndex, args.pathPrefix);

  const relCenter = args.filePath
    ? assertInsideRoot(args.filePath, config.root)
    : args.pathPrefix!;

  const result = buildModuleGraph(summaries, relCenter, {
    depth: args.depth ?? 2,
    direction: args.direction ?? "both",
    maxNodes: Math.min(args.limit ?? config.bounds.maxGraphNodes, config.bounds.maxGraphNodes),
    maxEdges: config.bounds.maxGraphEdges,
  });

  return toolResult(result);
}

export function ensureParsed(
  inventory: RepoInventory,
  config: ReflectConfig,
  cache: MemoryCache,
  symbolIndex: SymbolIndex,
  pathScope?: string,
): Map<string, ModuleSummary> {
  const summaries = new Map<string, ModuleSummary>();

  for (const file of inventory.files) {
    if (pathScope && !file.startsWith(pathScope)) continue;
    try {
      const summary = getOrParseModule(file, config, cache, symbolIndex);
      summaries.set(file, summary);
    } catch {
      // Skip unparseable files
    }
  }

  return summaries;
}
