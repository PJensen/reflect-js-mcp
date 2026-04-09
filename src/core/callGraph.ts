import type { ModuleSummary } from "../types/module.js";
import type { GraphNode, GraphEdge, GraphResult } from "../types/graph.js";

export function buildModuleGraph(
  summaries: Map<string, ModuleSummary>,
  center: string,
  opts: { depth?: number; direction?: "inbound" | "outbound" | "both"; maxNodes?: number; maxEdges?: number } = {},
): GraphResult {
  const depth = opts.depth ?? 2;
  const direction = opts.direction ?? "both";
  const maxNodes = opts.maxNodes ?? 200;
  const maxEdges = opts.maxEdges ?? 400;

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const unresolved: string[] = [];

  // Build import index for inbound lookups
  const importedBy = new Map<string, Set<string>>();
  for (const [fp, summary] of summaries) {
    for (const imp of summary.imports) {
      const resolved = resolveImportSource(imp.source, fp, summaries);
      if (resolved) {
        const set = importedBy.get(resolved) ?? new Set();
        set.add(fp);
        importedBy.set(resolved, set);
      }
    }
  }

  function addNode(id: string, kind: GraphNode["kind"] = "file"): boolean {
    if (nodes.size >= maxNodes) return false;
    if (!nodes.has(id)) {
      nodes.set(id, { id, label: id, kind, filePath: kind === "file" ? id : undefined });
    }
    return true;
  }

  function addEdge(source: string, target: string, kind: GraphEdge["kind"]): boolean {
    if (edges.length >= maxEdges) return false;
    edges.push({ source, target, kind });
    return true;
  }

  // BFS from center
  const visited = new Set<string>();
  const queue: Array<{ file: string; d: number }> = [{ file: center, d: 0 }];
  visited.add(center);
  addNode(center);

  while (queue.length > 0) {
    const { file, d } = queue.shift()!;
    if (d >= depth) continue;

    const summary = summaries.get(file);

    // Outbound
    if (direction === "outbound" || direction === "both") {
      if (summary) {
        for (const imp of summary.imports) {
          const resolved = resolveImportSource(imp.source, file, summaries);
          if (resolved) {
            if (addNode(resolved)) {
              addEdge(file, resolved, "import");
              if (!visited.has(resolved)) {
                visited.add(resolved);
                queue.push({ file: resolved, d: d + 1 });
              }
            }
          } else if (!imp.source.startsWith(".")) {
            if (addNode(imp.source, "external")) {
              addEdge(file, imp.source, "import");
            }
          } else {
            unresolved.push(imp.source);
          }
        }
      }
    }

    // Inbound
    if (direction === "inbound" || direction === "both") {
      const inbound = importedBy.get(file) ?? new Set();
      for (const src of inbound) {
        if (addNode(src)) {
          addEdge(src, file, "import");
          if (!visited.has(src)) {
            visited.add(src);
            queue.push({ file: src, d: d + 1 });
          }
        }
      }
    }
  }

  return {
    nodes: [...nodes.values()],
    edges,
    truncated: nodes.size >= maxNodes || edges.length >= maxEdges,
    unresolved: [...new Set(unresolved)],
  };
}

export function buildCallGraph(
  summary: ModuleSummary,
  symbolName?: string,
  opts: { maxNodes?: number; maxEdges?: number } = {},
): GraphResult {
  const maxNodes = opts.maxNodes ?? 200;
  const maxEdges = opts.maxEdges ?? 400;
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  const fns = symbolName ? summary.functions.filter((f) => f.name === symbolName) : summary.functions;

  for (const fn of fns) {
    if (nodes.size >= maxNodes) break;
    const fnId = `${summary.filePath}:${fn.name}`;
    nodes.set(fnId, { id: fnId, label: fn.name, kind: "function", filePath: summary.filePath });

    for (const call of [...fn.callsInternal, ...fn.callsOut]) {
      if (edges.length >= maxEdges) break;
      const callId = call.includes(".") ? call : `${summary.filePath}:${call}`;
      const isInternal = fn.callsInternal.includes(call);
      if (!nodes.has(callId) && nodes.size < maxNodes) {
        nodes.set(callId, { id: callId, label: call, kind: isInternal ? "function" : "external" });
      }
      if (nodes.has(callId)) {
        edges.push({ source: fnId, target: callId, kind: "call" });
      }
    }
  }

  return {
    nodes: [...nodes.values()],
    edges,
    truncated: nodes.size >= maxNodes || edges.length >= maxEdges,
    unresolved: [],
  };
}

function resolveImportSource(source: string, fromFile: string, summaries: Map<string, ModuleSummary>): string | null {
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
  const candidates = [
    base,
    `${base}.js`, `${base}.mjs`, `${base}.ts`, `${base}.tsx`, `${base}.jsx`,
    `${base}/index.js`, `${base}/index.ts`, `${base}/index.mjs`,
  ];

  for (const c of candidates) {
    if (summaries.has(c)) return c;
  }

  return null;
}
