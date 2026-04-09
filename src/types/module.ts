export type ModuleKind = "esm" | "cjs" | "mixed" | "unknown";

export interface ImportInfo {
  source: string;
  specifiers: ImportSpecifier[];
  isDynamic: boolean;
  loc: SourceLocation;
}

export interface ImportSpecifier {
  imported: string;
  local: string;
  kind: "default" | "named" | "namespace";
}

export interface ExportInfo {
  name: string;
  kind: "default" | "named" | "namespace" | "re-export";
  source?: string;
  loc: SourceLocation;
}

export interface DeclarationInfo {
  name: string;
  kind: "function" | "class" | "variable" | "const" | "let" | "var" | "type" | "interface" | "enum";
  exported: boolean;
  loc: SourceLocation;
}

export interface ClosureCapture {
  name: string;
  mode: "read" | "write" | "readwrite";
  declaredIn: string;
  declaredLine: number;
}

export interface FunctionSummary {
  name: string;
  kind: "function" | "method" | "arrow" | "getter" | "setter" | "constructor";
  params: string[];
  async: boolean;
  generator: boolean;
  loc: SourceLocation;
  lineCount: number;
  complexity: number;
  callsOut: string[];
  callsInternal: string[];
  closureCaptures?: ClosureCapture[];
}

export interface ClassSummary {
  name: string;
  superClass: string | null;
  methods: FunctionSummary[];
  properties: string[];
  loc: SourceLocation;
}

export interface ModuleSummary {
  filePath: string;
  moduleKind: ModuleKind;
  imports: ImportInfo[];
  exports: ExportInfo[];
  declarations: DeclarationInfo[];
  functions: FunctionSummary[];
  classes: ClassSummary[];
  lineCount: number;
  parseErrors: string[];
}

export interface SourceLocation {
  start: { line: number; column: number };
  end: { line: number; column: number };
}
