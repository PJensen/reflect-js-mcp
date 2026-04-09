import { describe, it, expect } from "vitest";
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

describe("summarizeModule", () => {
  it("extracts ESM imports", () => {
    const code = `import { foo, bar } from "./utils.js";\nimport def from "./default.js";`;
    const summary = summarizeModule(code, "test.js", config);
    expect(summary.moduleKind).toBe("esm");
    expect(summary.imports).toHaveLength(2);
    expect(summary.imports[0].source).toBe("./utils.js");
    expect(summary.imports[0].specifiers).toHaveLength(2);
    expect(summary.imports[1].specifiers[0].kind).toBe("default");
  });

  it("extracts CJS require calls", () => {
    const code = `const fs = require("fs");\nconst path = require("path");`;
    const summary = summarizeModule(code, "test.js", config);
    expect(summary.moduleKind).toBe("cjs");
    expect(summary.imports).toHaveLength(2);
    expect(summary.imports[0].source).toBe("fs");
  });

  it("detects mixed module kind", () => {
    const code = `import { foo } from "./foo.js";\nconst bar = require("bar");`;
    const summary = summarizeModule(code, "test.js", config);
    expect(summary.moduleKind).toBe("mixed");
  });

  it("extracts named exports", () => {
    const code = `export function greet() { return "hi"; }\nexport const PI = 3.14;`;
    const summary = summarizeModule(code, "test.js", config);
    expect(summary.exports).toHaveLength(2);
    expect(summary.exports.map((e) => e.name)).toContain("greet");
    expect(summary.exports.map((e) => e.name)).toContain("PI");
  });

  it("extracts default export", () => {
    const code = `export default function main() { console.log("hello"); }`;
    const summary = summarizeModule(code, "test.js", config);
    expect(summary.exports).toHaveLength(1);
    expect(summary.exports[0].kind).toBe("default");
  });

  it("extracts function summaries with complexity", () => {
    const code = `
export function complex(x) {
  if (x > 0) {
    for (let i = 0; i < x; i++) {
      if (i % 2 === 0) {
        console.log(i);
      }
    }
  } else if (x < 0) {
    while (x < 0) {
      x++;
    }
  }
  return x;
}`;
    const summary = summarizeModule(code, "test.js", config);
    const fn = summary.functions.find((f) => f.name === "complex");
    expect(fn).toBeTruthy();
    expect(fn!.complexity).toBeGreaterThan(1);
    expect(fn!.params).toEqual(["x"]);
  });

  it("extracts class declarations", () => {
    const code = `
export class Animal {
  constructor(name) { this.name = name; }
  speak() { return this.name + " speaks"; }
  get displayName() { return this.name.toUpperCase(); }
}`;
    const summary = summarizeModule(code, "test.js", config);
    expect(summary.classes).toHaveLength(1);
    expect(summary.classes[0].name).toBe("Animal");
    expect(summary.classes[0].methods).toHaveLength(3);
  });

  it("extracts arrow functions", () => {
    const code = `export const add = (a, b) => a + b;`;
    const summary = summarizeModule(code, "test.js", config);
    expect(summary.functions).toHaveLength(1);
    expect(summary.functions[0].kind).toBe("arrow");
  });

  it("extracts TypeScript declarations", () => {
    const code = `
export interface Config { name: string; }
export type Mode = "light" | "dark";
export enum Color { Red, Green, Blue }
`;
    const summary = summarizeModule(code, "test.ts", config);
    expect(summary.declarations.filter((d) => d.kind === "interface")).toHaveLength(1);
    expect(summary.declarations.filter((d) => d.kind === "type")).toHaveLength(1);
    expect(summary.declarations.filter((d) => d.kind === "enum")).toHaveLength(1);
  });

  it("tracks outbound calls", () => {
    const code = `
function doWork() {
  console.log("start");
  fetch("/api");
  helper();
}
function helper() { return 42; }
`;
    const summary = summarizeModule(code, "test.js", config);
    const fn = summary.functions.find((f) => f.name === "doWork");
    expect(fn!.callsOut).toContain("console.log");
    expect(fn!.callsInternal).toContain("fetch");
    expect(fn!.callsInternal).toContain("helper");
  });

  it("handles parse errors gracefully", () => {
    const code = `export function broken( { return; }`;
    const summary = summarizeModule(code, "test.js", config);
    expect(summary.parseErrors.length).toBeGreaterThan(0);
  });

  it("extracts re-exports", () => {
    const code = `export { foo, bar } from "./utils.js";`;
    const summary = summarizeModule(code, "test.js", config);
    expect(summary.exports).toHaveLength(2);
    expect(summary.exports[0].kind).toBe("re-export");
    expect(summary.exports[0].source).toBe("./utils.js");
  });

  it("detects dynamic imports", () => {
    const code = `const mod = await import("./lazy.js");`;
    const summary = summarizeModule(code, "test.js", config);
    expect(summary.imports).toHaveLength(1);
    expect(summary.imports[0].isDynamic).toBe(true);
  });
});
