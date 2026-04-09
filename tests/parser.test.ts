import { describe, it, expect } from "vitest";
import { parseSource } from "../src/core/parser.js";
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

describe("parser", () => {
  it("parses basic JS", () => {
    const ast = parseSource("const x = 1;", "test.js", config);
    expect(ast.type).toBe("File");
    expect(ast.program.body.length).toBe(1);
  });

  it("parses ESM imports and exports", () => {
    const code = `import { foo } from "./bar.js";\nexport const x = foo();`;
    const ast = parseSource(code, "test.js", config);
    expect(ast.program.body.length).toBe(2);
  });

  it("parses TypeScript", () => {
    const code = `interface Foo { bar: string; }\nconst x: Foo = { bar: "hello" };`;
    const ast = parseSource(code, "test.ts", config);
    expect(ast.program.body.length).toBe(2);
  });

  it("parses JSX", () => {
    const code = `const el = <div className="test">Hello</div>;`;
    const ast = parseSource(code, "test.jsx", config);
    expect(ast.program.body.length).toBe(1);
  });

  it("handles parse errors with recovery", () => {
    // Some syntax errors are unrecoverable even with errorRecovery — that's expected.
    // The summarizeModule layer catches these. Here we just confirm it throws.
    const code = `const x = {;`;
    expect(() => parseSource(code, "test.js", config)).toThrow();
  });
});
