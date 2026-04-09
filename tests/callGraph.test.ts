import { describe, it, expect } from "vitest";
import { buildModuleGraph, buildCallGraph } from "../src/core/callGraph.js";
import { summarizeModule } from "../src/core/moduleSummary.js";
import type { ModuleSummary } from "../src/types/module.js";
import type { ReflectConfig } from "../src/types/config.js";

const config: ReflectConfig = {
  root: ".",
  include: [],
  exclude: [],
  parser: { jsx: true, typescript: true },
  cache: { enabled: false, persist: false, dir: "" },
  watch: false,
  architecturalTags: {},
  bounds: { maxReadLines: 200, maxListResults: 200, maxGraphNodes: 200, maxGraphEdges: 400 },
};

function makeSummaries(files: Record<string, string>): Map<string, ModuleSummary> {
  const map = new Map<string, ModuleSummary>();
  for (const [path, code] of Object.entries(files)) {
    map.set(path, summarizeModule(code, path, config));
  }
  return map;
}

describe("buildModuleGraph", () => {
  it("builds outbound edges", () => {
    const summaries = makeSummaries({
      "a.js": `import { b } from "./b.js";`,
      "b.js": `import { c } from "./c.js";\nexport const b = 1;`,
      "c.js": `export const c = 2;`,
    });

    const result = buildModuleGraph(summaries, "a.js", { direction: "outbound", depth: 2 });
    expect(result.nodes.length).toBe(3);
    expect(result.edges).toHaveLength(2);
  });

  it("builds inbound edges", () => {
    const summaries = makeSummaries({
      "a.js": `import { c } from "./c.js";`,
      "b.js": `import { c } from "./c.js";`,
      "c.js": `export const c = 1;`,
    });

    const result = buildModuleGraph(summaries, "c.js", { direction: "inbound", depth: 1 });
    expect(result.nodes.length).toBe(3);
  });

  it("respects depth limit", () => {
    const summaries = makeSummaries({
      "a.js": `import "./b.js";`,
      "b.js": `import "./c.js";`,
      "c.js": `import "./d.js";`,
      "d.js": `export const d = 1;`,
    });

    const result = buildModuleGraph(summaries, "a.js", { direction: "outbound", depth: 1 });
    expect(result.nodes.length).toBe(2);
  });

  it("marks external dependencies", () => {
    const summaries = makeSummaries({
      "a.js": `import React from "react";\nimport { foo } from "./foo.js";`,
      "foo.js": `export const foo = 1;`,
    });

    const result = buildModuleGraph(summaries, "a.js", { direction: "outbound" });
    const ext = result.nodes.find((n) => n.kind === "external");
    expect(ext).toBeTruthy();
    expect(ext!.label).toBe("react");
  });
});

describe("buildCallGraph", () => {
  it("builds function call edges", () => {
    const summary = summarizeModule(
      `function a() { b(); c(); }\nfunction b() { c(); }\nfunction c() {}`,
      "test.js",
      config,
    );

    const result = buildCallGraph(summary);
    expect(result.nodes.length).toBeGreaterThanOrEqual(3);
    expect(result.edges.length).toBeGreaterThanOrEqual(3);
  });

  it("focuses on specific symbol", () => {
    const summary = summarizeModule(
      `function a() { b(); }\nfunction b() { c(); }\nfunction c() {}`,
      "test.js",
      config,
    );

    const result = buildCallGraph(summary, "a");
    const sourceNodes = new Set(result.edges.map((e) => e.source));
    expect(sourceNodes.size).toBe(1);
  });
});
