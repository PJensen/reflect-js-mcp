export interface GraphNode {
  id: string;
  label: string;
  kind: "file" | "function" | "class" | "external";
  filePath?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: "import" | "call" | "re-export";
}

export interface GraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
  unresolved: string[];
}
