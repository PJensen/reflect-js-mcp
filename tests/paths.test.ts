import { describe, it, expect } from "vitest";
import { assertInsideRoot, normalizePath } from "../src/util/paths.js";

describe("paths", () => {
  it("normalizes relative paths", () => {
    expect(normalizePath("src/foo.js", "/repo")).toBe("src/foo.js");
  });

  it("allows paths inside root", () => {
    expect(assertInsideRoot("src/foo.js", "/repo")).toBe("src/foo.js");
  });

  it("rejects paths escaping root", () => {
    expect(() => assertInsideRoot("../../etc/passwd", "/repo")).toThrow("outside repo root");
  });

  it("rejects absolute paths outside root", () => {
    expect(() => assertInsideRoot("/etc/passwd", "/repo")).toThrow("outside repo root");
  });

  it("normalizes dot segments", () => {
    expect(assertInsideRoot("src/../src/foo.js", "/repo")).toBe("src/foo.js");
  });
});
