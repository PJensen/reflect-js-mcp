import { describe, it, expect } from "vitest";
import path from "node:path";
import { scanRepo, readFileContent } from "../src/core/repo.js";
import { summarizeModule } from "../src/core/moduleSummary.js";
import { SymbolIndex } from "../src/core/symbolIndex.js";
import { MemoryCache } from "../src/cache/memoryCache.js";
import { buildModuleGraph } from "../src/core/callGraph.js";
import { rankHotspots } from "../src/core/hotspotRanker.js";
import { architecturalSlice } from "../src/core/subsystemInference.js";
import { readFileRegion } from "../src/core/excerpts.js";
import type { ReflectConfig } from "../src/types/config.js";
import type { ModuleSummary } from "../src/types/module.js";

const fixtureRoot = path.resolve(import.meta.dirname!, "../fixtures/sample");

const config: ReflectConfig = {
  root: fixtureRoot,
  include: ["**/*.js", "**/*.ts"],
  exclude: ["node_modules/**"],
  parser: { jsx: true, typescript: true },
  cache: { enabled: true, persist: false, dir: "" },
  watch: false,
  architecturalTags: {
    lighting: ["light", "visibility", "shadow", "brightness"],
    rendering: ["render", "draw", "canvas"],
  },
  bounds: { maxReadLines: 200, maxListResults: 200, maxGraphNodes: 200, maxGraphEdges: 400 },
};

describe("fixture: sample repo", () => {
  it("scans all files", async () => {
    const inventory = await scanRepo(config);
    expect(inventory.files.length).toBeGreaterThanOrEqual(5);
    expect(inventory.files).toContain("engine.js");
    expect(inventory.files).toContain("lighting.js");
  });

  it("summarizes engine.js", () => {
    const source = readFileContent("engine.js", fixtureRoot);
    const summary = summarizeModule(source, "engine.js", config);
    expect(summary.moduleKind).toBe("esm");
    expect(summary.imports).toHaveLength(3);
    expect(summary.classes).toHaveLength(1);
    expect(summary.classes[0].name).toBe("Engine");
    expect(summary.exports.map((e) => e.name)).toContain("createEngine");
    expect(summary.exports.map((e) => e.name)).toContain("VERSION");
  });

  it("summarizes CJS loader", () => {
    const source = readFileContent("levels/loader.js", fixtureRoot);
    const summary = summarizeModule(source, "levels/loader.js", config);
    expect(summary.moduleKind).toBe("cjs");
    expect(summary.imports.some((i) => i.source === "fs")).toBe(true);
  });

  it("summarizes TypeScript types", () => {
    const source = readFileContent("types.ts", fixtureRoot);
    const summary = summarizeModule(source, "types.ts", config);
    expect(summary.declarations.some((d) => d.kind === "interface")).toBe(true);
    expect(summary.declarations.some((d) => d.kind === "enum")).toBe(true);
    expect(summary.declarations.some((d) => d.kind === "type")).toBe(true);
  });

  it("builds module graph from engine.js", async () => {
    const inventory = await scanRepo(config);
    const summaries = new Map<string, ModuleSummary>();
    for (const file of inventory.files) {
      const src = readFileContent(file, fixtureRoot);
      summaries.set(file, summarizeModule(src, file, config));
    }

    const graph = buildModuleGraph(summaries, "engine.js", { direction: "outbound", depth: 2 });
    expect(graph.nodes.some((n) => n.id === "render.js")).toBe(true);
    expect(graph.nodes.some((n) => n.id === "update.js")).toBe(true);
  });

  it("finds symbols across fixture", async () => {
    const inventory = await scanRepo(config);
    const idx = new SymbolIndex();
    for (const file of inventory.files) {
      const src = readFileContent(file, fixtureRoot);
      idx.indexModule(summarizeModule(src, file, config));
    }

    const result = idx.search("computeVisibility");
    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0].filePath).toBe("lighting.js");
  });

  it("ranks hotspots in fixture", async () => {
    const inventory = await scanRepo(config);
    const summaries = new Map<string, ModuleSummary>();
    for (const file of inventory.files) {
      summaries.set(file, summarizeModule(readFileContent(file, fixtureRoot), file, config));
    }

    const result = rankHotspots(summaries, { limit: 5 });
    expect(result.hotspots.length).toBeGreaterThan(0);
    // lighting.js should rank high (most complex)
    expect(result.hotspots.some((h) => h.filePath === "lighting.js")).toBe(true);
  });

  it("slices for 'lighting' concern", async () => {
    const inventory = await scanRepo(config);
    const summaries = new Map<string, ModuleSummary>();
    for (const file of inventory.files) {
      summaries.set(file, summarizeModule(readFileContent(file, fixtureRoot), file, config));
    }

    const result = architecturalSlice("lighting", summaries, config);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files[0].filePath).toBe("lighting.js");
  });

  it("reads file regions with line numbers", () => {
    const result = readFileRegion("engine.js", fixtureRoot, 1, 5, 200);
    expect(result.startLine).toBe(1);
    expect(result.endLine).toBe(5);
    expect(result.content).toContain("import");
  });

  it("caches module summaries", () => {
    const cache = new MemoryCache();
    const source = readFileContent("engine.js", fixtureRoot);
    const summary = summarizeModule(source, "engine.js", config);
    cache.setModule("engine.js", "abc123", summary);

    const hit = cache.getModule("engine.js", "abc123");
    expect(hit).toBe(summary);

    const miss = cache.getModule("engine.js", "different");
    expect(miss).toBeNull();
  });
});
