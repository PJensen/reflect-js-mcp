import { describe, it, expect } from "vitest";
import { rankHotspots } from "../src/core/hotspotRanker.js";
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

describe("rankHotspots", () => {
  it("ranks complex files higher", () => {
    const summaries = new Map<string, ModuleSummary>();
    summaries.set("simple.js", summarizeModule(`export const x = 1;`, "simple.js", config));
    summaries.set(
      "complex.js",
      summarizeModule(
        `
import { a } from "./a.js";
import { b } from "./b.js";
import { c } from "./c.js";
export function bigFunction(x) {
  if (x > 0) {
    for (let i = 0; i < x; i++) {
      if (i % 2) { a(i); } else { b(i); }
      while (x > 10) { x--; c(x); }
    }
  }
  return x;
}`,
        "complex.js",
        config,
      ),
    );

    const result = rankHotspots(summaries);
    expect(result.hotspots[0].filePath).toBe("complex.js");
  });

  it("respects pathScope", () => {
    const summaries = new Map<string, ModuleSummary>();
    summaries.set("src/a.js", summarizeModule(`export function foo() { bar(); baz(); }`, "src/a.js", config));
    summaries.set("lib/b.js", summarizeModule(`export function huge() { a(); b(); c(); d(); e(); }`, "lib/b.js", config));

    const result = rankHotspots(summaries, { pathScope: "src/" });
    expect(result.hotspots.every((h) => h.filePath.startsWith("src/"))).toBe(true);
  });

  it("respects limit", () => {
    const summaries = new Map<string, ModuleSummary>();
    for (let i = 0; i < 10; i++) {
      summaries.set(`f${i}.js`, summarizeModule(`export function f${i}() {}`, `f${i}.js`, config));
    }
    const result = rankHotspots(summaries, { limit: 3 });
    expect(result.hotspots.length).toBeLessThanOrEqual(3);
    expect(result.truncated).toBe(true);
  });
});
