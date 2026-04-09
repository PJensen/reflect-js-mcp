import { describe, it, expect } from "vitest";
import { analyzeClosures } from "../src/core/moduleSummary.js";
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

describe("analyzeClosures", () => {
  it("detects read-only closure captures", () => {
    const code = `
function outer() {
  const items = [];
  const config = { x: 1 };

  function reader() {
    console.log(items.length);
    return config.x;
  }
}`;
    const results = analyzeClosures(code, "test.js", config);
    const reader = results.find((f) => f.name === "reader");
    expect(reader).toBeTruthy();
    expect(reader!.closureCaptures).toHaveLength(2);

    const itemsCapture = reader!.closureCaptures.find((c) => c.name === "items");
    expect(itemsCapture).toBeTruthy();
    expect(itemsCapture!.mode).toBe("read");
    expect(itemsCapture!.declaredIn).toBe("outer");

    const configCapture = reader!.closureCaptures.find((c) => c.name === "config");
    expect(configCapture).toBeTruthy();
    expect(configCapture!.mode).toBe("read");
  });

  it("detects write captures via assignment", () => {
    const code = `
function outer() {
  let count = 0;

  function increment() {
    count++;
    return count;
  }
}`;
    const results = analyzeClosures(code, "test.js", config);
    const inc = results.find((f) => f.name === "increment");
    expect(inc).toBeTruthy();
    const capture = inc!.closureCaptures.find((c) => c.name === "count");
    expect(capture).toBeTruthy();
    expect(capture!.mode).toBe("readwrite");
  });

  it("detects write captures via mutating methods (.push, .splice, .delete)", () => {
    const code = `
function controller() {
  const fxList = [];
  const channelMap = new Map();

  function addFx(item) {
    fxList.push(item);
  }

  function removeCh(id) {
    channelMap.delete(id);
  }

  function readFx() {
    return fxList.length;
  }
}`;
    const results = analyzeClosures(code, "test.js", config);

    const addFx = results.find((f) => f.name === "addFx");
    expect(addFx).toBeTruthy();
    const fxCapture = addFx!.closureCaptures.find((c) => c.name === "fxList");
    expect(fxCapture!.mode).toBe("write");

    const removeCh = results.find((f) => f.name === "removeCh");
    expect(removeCh).toBeTruthy();
    const mapCapture = removeCh!.closureCaptures.find((c) => c.name === "channelMap");
    expect(mapCapture!.mode).toBe("write");

    const readFx = results.find((f) => f.name === "readFx");
    expect(readFx).toBeTruthy();
    const readCapture = readFx!.closureCaptures.find((c) => c.name === "fxList");
    expect(readCapture!.mode).toBe("read");
  });

  it("excludes parameters and local variables from captures", () => {
    const code = `
function outer() {
  const shared = 42;

  function inner(x) {
    const local = 10;
    return x + local + shared;
  }
}`;
    const results = analyzeClosures(code, "test.js", config);
    const inner = results.find((f) => f.name === "inner");
    expect(inner).toBeTruthy();
    expect(inner!.closureCaptures).toHaveLength(1);
    expect(inner!.closureCaptures[0].name).toBe("shared");
  });

  it("filters by function name when specified", () => {
    const code = `
function outer() {
  const x = 1;
  function a() { return x; }
  function b() { return x; }
}`;
    const all = analyzeClosures(code, "test.js", config);
    expect(all.length).toBeGreaterThanOrEqual(2);

    const filtered = analyzeClosures(code, "test.js", config, "a");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("a");
  });

  it("returns empty captures for functions with no closure variables", () => {
    const code = `
function pure(x, y) {
  const z = x + y;
  return z * 2;
}`;
    const results = analyzeClosures(code, "test.js", config);
    // pure has no closure captures, so it shouldn't appear (unless filtered by name)
    const pure = results.find((f) => f.name === "pure");
    expect(pure).toBeUndefined();

    // But when explicitly requested, it should return with empty captures
    const explicit = analyzeClosures(code, "test.js", config, "pure");
    expect(explicit).toHaveLength(1);
    expect(explicit[0].closureCaptures).toHaveLength(0);
  });

  it("handles the spellAreaFx pattern: factory with draw vs mutator functions", () => {
    const code = `
export function createController({ world, getFxTime }) {
  const _blinkFx = [];
  const _meteorFx = [];

  function drawBlink(ctx) {
    for (const eff of _blinkFx) {
      const t = getFxTime();
      ctx.arc(eff.x, eff.y, t, 0, Math.PI * 2);
    }
  }

  function tick(dt) {
    for (let i = _blinkFx.length - 1; i >= 0; i--) {
      _blinkFx[i].tick(dt);
      if (_blinkFx[i].expired) _blinkFx.splice(i, 1);
    }
  }

  function installListeners() {
    world.on('spell:blink', (ev) => {
      _blinkFx.push({ x: ev.x, y: ev.y });
      _meteorFx.push({ x: ev.x, y: ev.y });
    });
  }

  return { drawBlink, tick, installListeners };
}`;
    const results = analyzeClosures(code, "test.js", config);

    const draw = results.find((f) => f.name === "drawBlink");
    expect(draw).toBeTruthy();
    const drawBlink = draw!.closureCaptures.find((c) => c.name === "_blinkFx");
    expect(drawBlink!.mode).toBe("read");
    const drawGetFxTime = draw!.closureCaptures.find((c) => c.name === "getFxTime");
    expect(drawGetFxTime!.mode).toBe("read");

    const tickFn = results.find((f) => f.name === "tick");
    expect(tickFn).toBeTruthy();
    const tickBlink = tickFn!.closureCaptures.find((c) => c.name === "_blinkFx");
    expect(tickBlink!.mode).toBe("readwrite"); // reads _blinkFx[i].tick() AND writes via .splice()

    const listeners = results.find((f) => f.name === "installListeners");
    expect(listeners).toBeTruthy();
    const listenerBlink = listeners!.closureCaptures.find((c) => c.name === "_blinkFx");
    expect(listenerBlink!.mode).toBe("write");
    const listenerMeteor = listeners!.closureCaptures.find((c) => c.name === "_meteorFx");
    expect(listenerMeteor!.mode).toBe("write");
    const listenerWorld = listeners!.closureCaptures.find((c) => c.name === "world");
    expect(listenerWorld!.mode).toBe("read");
  });
});
