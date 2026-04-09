import type { ModuleSummary } from "../types/module.js";
import type { HotspotEntry, HotspotResult } from "../types/hotspot.js";

export function rankHotspots(
  summaries: Map<string, ModuleSummary>,
  opts: { pathScope?: string; limit?: number } = {},
): HotspotResult {
  const limit = opts.limit ?? 20;
  const entries: HotspotEntry[] = [];

  // Build inbound edge counts
  const inboundCount = new Map<string, number>();
  for (const summary of summaries.values()) {
    for (const imp of summary.imports) {
      if (imp.source.startsWith(".")) {
        const resolved = resolveRelative(imp.source, summary.filePath, summaries);
        if (resolved) {
          inboundCount.set(resolved, (inboundCount.get(resolved) ?? 0) + 1);
        }
      }
    }
  }

  for (const [filePath, summary] of summaries) {
    if (opts.pathScope && !filePath.startsWith(opts.pathScope)) continue;

    // File-level hotspot
    const totalComplexity = summary.functions.reduce((s, f) => s + f.complexity, 0);
    const totalFanOut = summary.imports.length + summary.functions.reduce((s, f) => s + f.callsOut.length, 0);
    const fanIn = inboundCount.get(filePath) ?? 0;
    const lineCount = summary.lineCount;

    const score =
      totalComplexity * 2 +
      totalFanOut * 1.5 +
      fanIn * 3 +
      (lineCount > 300 ? lineCount * 0.1 : 0) +
      summary.declarations.length * 0.5;

    const reasons: string[] = [];
    if (totalComplexity > 20) reasons.push(`high complexity (${totalComplexity})`);
    if (totalFanOut > 10) reasons.push(`high fan-out (${totalFanOut})`);
    if (fanIn > 5) reasons.push(`high fan-in (${fanIn})`);
    if (lineCount > 300) reasons.push(`large file (${lineCount} lines)`);
    if (reasons.length === 0) reasons.push("moderate structural importance");

    entries.push({
      filePath,
      complexity: totalComplexity,
      fanOut: totalFanOut,
      fanIn,
      lineCount,
      score: Math.round(score * 100) / 100,
      explanation: reasons.join("; "),
    });

    // Function-level hotspots for complex functions
    for (const fn of summary.functions) {
      if (fn.complexity >= 5 || fn.callsOut.length + fn.callsInternal.length >= 5) {
        const fnFanOut = fn.callsOut.length + fn.callsInternal.length;
        const fnScore = fn.complexity * 2 + fnFanOut * 1.5 + fn.lineCount * 0.2;

        const fnReasons: string[] = [];
        if (fn.complexity >= 5) fnReasons.push(`complexity ${fn.complexity}`);
        if (fnFanOut >= 5) fnReasons.push(`fan-out ${fnFanOut}`);
        if (fn.lineCount > 50) fnReasons.push(`${fn.lineCount} lines`);
        if (fnReasons.length === 0) fnReasons.push("notable function");

        entries.push({
          filePath,
          symbol: fn.name,
          complexity: fn.complexity,
          fanOut: fnFanOut,
          fanIn: 0,
          lineCount: fn.lineCount,
          score: Math.round(fnScore * 100) / 100,
          explanation: fnReasons.join("; "),
        });
      }
    }
  }

  entries.sort((a, b) => b.score - a.score);
  const truncated = entries.length > limit;

  return {
    hotspots: entries.slice(0, limit),
    truncated,
  };
}

function resolveRelative(source: string, fromFile: string, summaries: Map<string, ModuleSummary>): string | null {
  if (!source.startsWith(".")) return null;
  const dir = fromFile.includes("/") ? fromFile.slice(0, fromFile.lastIndexOf("/")) : "";
  const parts = source.split("/");
  const segments = dir ? dir.split("/") : [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") segments.pop();
    else segments.push(part);
  }
  const base = segments.join("/");
  const candidates = [base, `${base}.js`, `${base}.mjs`, `${base}.ts`, `${base}.tsx`, `${base}/index.js`, `${base}/index.ts`];
  for (const c of candidates) {
    if (summaries.has(c)) return c;
  }
  return null;
}
