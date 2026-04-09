import type { SourceLocation } from "./module.js";

export interface SymbolEntry {
  name: string;
  kind: "function" | "class" | "variable" | "method" | "type" | "interface" | "enum" | "export" | "import";
  filePath: string;
  loc: SourceLocation;
  exported: boolean;
}

export interface SymbolSearchResult {
  definitions: SymbolEntry[];
  references: SymbolReference[];
  truncated: boolean;
}

export interface SymbolReference {
  name: string;
  filePath: string;
  loc: SourceLocation;
  context: "call" | "import" | "assignment" | "reference";
}
