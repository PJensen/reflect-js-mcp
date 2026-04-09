import { describe, it, expect } from "vitest";
import { SymbolIndex } from "../src/core/symbolIndex.js";
import { summarizeModule } from "../src/core/moduleSummary.js";
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

describe("SymbolIndex", () => {
  it("indexes function declarations", () => {
    const idx = new SymbolIndex();
    const summary = summarizeModule(`export function greet() {}`, "a.js", config);
    idx.indexModule(summary);

    const result = idx.search("greet");
    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0].name).toBe("greet");
    expect(result.definitions[0].kind).toBe("function");
    expect(result.definitions[0].exported).toBe(true);
  });

  it("supports substring search", () => {
    const idx = new SymbolIndex();
    idx.indexModule(summarizeModule(`export function computeVisibility() {}`, "a.js", config));
    idx.indexModule(summarizeModule(`export function computeBrightness() {}`, "b.js", config));

    const result = idx.search("compute");
    expect(result.definitions).toHaveLength(2);
  });

  it("indexes class methods as qualified names", () => {
    const idx = new SymbolIndex();
    const code = `class Engine { start() {} stop() {} }`;
    idx.indexModule(summarizeModule(code, "engine.js", config));

    const result = idx.search("Engine.start");
    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0].kind).toBe("method");
  });

  it("removes file on re-index", () => {
    const idx = new SymbolIndex();
    idx.indexModule(summarizeModule(`export function foo() {}`, "a.js", config));
    expect(idx.search("foo").definitions).toHaveLength(1);

    idx.indexModule(summarizeModule(`export function bar() {}`, "a.js", config));
    expect(idx.search("foo").definitions).toHaveLength(0);
    expect(idx.search("bar").definitions).toHaveLength(1);
  });

  it("filters by kind", () => {
    const idx = new SymbolIndex();
    idx.indexModule(summarizeModule(`export function foo() {}\nexport class Foo {}`, "a.js", config));

    expect(idx.search("foo", { kind: "function" }).definitions).toHaveLength(1);
    expect(idx.search("Foo", { kind: "class" }).definitions).toHaveLength(1);
  });

  it("filters by pathScope", () => {
    const idx = new SymbolIndex();
    idx.indexModule(summarizeModule(`export function foo() {}`, "src/a.js", config));
    idx.indexModule(summarizeModule(`export function foo() {}`, "lib/b.js", config));

    expect(idx.search("foo", { pathScope: "src/" }).definitions).toHaveLength(1);
  });

  it("ranks exact matches first", () => {
    const idx = new SymbolIndex();
    idx.indexModule(summarizeModule(`export function render() {}`, "a.js", config));
    idx.indexModule(summarizeModule(`export function renderEntity() {}`, "b.js", config));

    const result = idx.search("render");
    expect(result.definitions[0].name).toBe("render");
  });
});
