#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { loadConfig } from "./config/loadConfig.js";
import { scanRepo, type RepoInventory } from "./core/repo.js";
import { MemoryCache } from "./cache/memoryCache.js";
import { SymbolIndex } from "./core/symbolIndex.js";

import { handlePing } from "./tools/ping.js";
import { handleProjectSummary } from "./tools/projectSummary.js";
import { handleListProjectFiles } from "./tools/listProjectFiles.js";
import { handleReadFileRegion } from "./tools/readFileRegion.js";
import { handleReflectModule } from "./tools/reflectModule.js";
import { handleReflectFunctions } from "./tools/reflectFunctions.js";
import { handleFindSymbol } from "./tools/findSymbol.js";
import { handleModuleGraph } from "./tools/moduleGraph.js";
import { handleCallGraph } from "./tools/callGraph.js";
import { handleHotspots } from "./tools/hotspots.js";
import { handleArchitecturalSlice } from "./tools/architecturalSlice.js";
import { handleRefreshIndex } from "./tools/refreshIndex.js";

async function main() {
  const rootArg = process.argv[2];
  const config = await loadConfig(rootArg);
  const cache = new MemoryCache();
  const symbolIndex = new SymbolIndex();
  let inventory: RepoInventory = await scanRepo(config);

  const server = new McpServer({
    name: "reflect-js",
    version: "0.1.0",
  });

  // 1. ping
  server.tool("ping", "Health check", {}, () => handlePing());

  // 2. project_summary
  server.tool("project_summary", "Top-level repo information", {}, () =>
    handleProjectSummary(inventory, config, symbolIndex, cache),
  );

  // 3. list_project_files
  server.tool(
    "list_project_files",
    "Bounded file listing with optional glob/prefix filtering",
    {
      pathPrefix: z.string().optional().describe("Filter files starting with this path prefix"),
      glob: z.string().optional().describe("Glob pattern to filter files"),
      limit: z.number().optional().describe("Max results to return"),
      offset: z.number().optional().describe("Offset for pagination"),
    },
    (args) => handleListProjectFiles(inventory, config.bounds, args),
  );

  // 4. read_file_region
  server.tool(
    "read_file_region",
    "Read a bounded code excerpt by path and line range",
    {
      filePath: z.string().describe("Path to the file (relative to repo root)"),
      startLine: z.number().optional().describe("First line to read (1-indexed, default 1)"),
      endLine: z.number().optional().describe("Last line to read"),
      maxLines: z.number().optional().describe("Maximum lines to return"),
    },
    (args) => handleReadFileRegion(config.root, config.bounds, args),
  );

  // 5. reflect_module
  server.tool(
    "reflect_module",
    "Structural summary of one module: imports, exports, declarations, functions, classes",
    {
      filePath: z.string().describe("Path to the module file"),
    },
    (args) => handleReflectModule(config, cache, symbolIndex, args),
  );

  // 6. reflect_functions
  server.tool(
    "reflect_functions",
    "Function-level structural summaries for one file",
    {
      filePath: z.string().describe("Path to the file"),
      nameFilter: z.string().optional().describe("Filter functions by name substring"),
    },
    (args) => handleReflectFunctions(config, cache, symbolIndex, args),
  );

  // 7. find_symbol
  server.tool(
    "find_symbol",
    "Locate symbol definitions across the indexed codebase",
    {
      symbol: z.string().describe("Symbol name or substring to search for"),
      kind: z.string().optional().describe("Filter by symbol kind (function, class, variable, etc.)"),
      pathScope: z.string().optional().describe("Restrict search to files under this path prefix"),
      limit: z.number().optional().describe("Max results"),
    },
    (args) => handleFindSymbol(symbolIndex, args),
  );

  // 8. module_graph
  server.tool(
    "module_graph",
    "Bounded dependency graph centered on a file or subtree",
    {
      filePath: z.string().optional().describe("Center file for the graph"),
      pathPrefix: z.string().optional().describe("Subtree prefix to graph"),
      depth: z.number().optional().describe("Graph traversal depth (default 2)"),
      direction: z.enum(["inbound", "outbound", "both"]).optional().describe("Edge direction"),
      limit: z.number().optional().describe("Max nodes"),
    },
    (args) => handleModuleGraph(config, cache, symbolIndex, inventory, args),
  );

  // 9. call_graph
  server.tool(
    "call_graph",
    "Static call graph hints for a file or function",
    {
      filePath: z.string().describe("Path to the file"),
      symbol: z.string().optional().describe("Focus on a specific function"),
      depth: z.number().optional().describe("Traversal depth"),
      limit: z.number().optional().describe("Max nodes"),
    },
    (args) => handleCallGraph(config, cache, symbolIndex, args),
  );

  // 10. hotspots
  server.tool(
    "hotspots",
    "Rank structurally important or risky code locations",
    {
      pathScope: z.string().optional().describe("Restrict to files under this prefix"),
      limit: z.number().optional().describe("Max hotspots to return"),
    },
    (args) => handleHotspots(config, cache, symbolIndex, inventory, args),
  );

  // 11. architectural_slice
  server.tool(
    "architectural_slice",
    "Best-effort subsystem slice for a concern (e.g. 'lighting', 'combat', 'auth')",
    {
      query: z.string().describe("Concern to slice for"),
      pathScope: z.string().optional().describe("Restrict to files under this prefix"),
      limit: z.number().optional().describe("Max results"),
    },
    (args) => handleArchitecturalSlice(config, cache, symbolIndex, inventory, args),
  );

  // 12. refresh_index
  server.tool(
    "refresh_index",
    "Re-scan repo and invalidate stale cache entries",
    {
      pathScope: z.string().optional().describe("Restrict refresh to files under this prefix"),
    },
    async (args) => {
      const result = await handleRefreshIndex(config, cache, symbolIndex, inventory, args);
      inventory = result.inventory;
      return result.response;
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("reflect-js: fatal error:", err);
  process.exit(1);
});
