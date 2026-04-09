import _traverse from "@babel/traverse";
import * as t from "@babel/types";

// Handle CJS/ESM interop for @babel/traverse
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const traverse: any = (typeof _traverse === "function" ? _traverse : (_traverse as any).default);
import type {
  ModuleSummary,
  ModuleKind,
  ImportInfo,
  ImportSpecifier,
  ExportInfo,
  DeclarationInfo,
  FunctionSummary,
  ClosureCapture,
  ClassSummary,
  SourceLocation,
} from "../types/module.js";
import { parseSource } from "./parser.js";
import type { ReflectConfig } from "../types/config.js";

function toLoc(node: { loc?: { start: { line: number; column: number }; end: { line: number; column: number } } | null }): SourceLocation {
  return {
    start: { line: node.loc?.start.line ?? 0, column: node.loc?.start.column ?? 0 },
    end: { line: node.loc?.end.line ?? 0, column: node.loc?.end.column ?? 0 },
  };
}

function computeComplexity(body: t.Node): number {
  let complexity = 1;
  traverse(body, {
    noScope: true,
    IfStatement() { complexity++; },
    ConditionalExpression() { complexity++; },
    ForStatement() { complexity++; },
    ForInStatement() { complexity++; },
    ForOfStatement() { complexity++; },
    WhileStatement() { complexity++; },
    DoWhileStatement() { complexity++; },
    SwitchCase(path: any) { if (path.node.test) complexity++; },
    LogicalExpression({ node }: any) { if (node.operator === "&&" || node.operator === "||" || node.operator === "??") complexity++; },
    CatchClause() { complexity++; },
  });
  return complexity;
}

function extractCallNames(body: t.Node): { out: string[]; internal: string[] } {
  const out: string[] = [];
  const internal: string[] = [];

  traverse(body, {
    noScope: true,
    CallExpression(path: any) {
      const callee = path.node.callee;
      if (t.isIdentifier(callee)) {
        internal.push(callee.name);
      } else if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
        const obj = t.isIdentifier(callee.object) ? callee.object.name : "?";
        out.push(`${obj}.${callee.property.name}`);
      }
    },
  });

  return { out: [...new Set(out)], internal: [...new Set(internal)] };
}

const MUTATING_METHODS = new Set([
  "push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill",
  "set", "delete", "clear", "add",
]);

function extractFunctionSummary(
  name: string,
  kind: FunctionSummary["kind"],
  node: t.Function,
): FunctionSummary {
  const params = node.params.map((p) => {
    if (t.isIdentifier(p)) return p.name;
    if (t.isAssignmentPattern(p) && t.isIdentifier(p.left)) return p.left.name;
    if (t.isRestElement(p) && t.isIdentifier(p.argument)) return `...${p.argument.name}`;
    return "?";
  });

  const body = node.body;
  const calls = body ? extractCallNames(body) : { out: [], internal: [] };
  const lineCount = (node.loc?.end.line ?? 0) - (node.loc?.start.line ?? 0) + 1;

  return {
    name,
    kind,
    params,
    async: node.async ?? false,
    generator: node.generator ?? false,
    loc: toLoc(node),
    lineCount,
    complexity: body ? computeComplexity(body) : 1,
    callsOut: calls.out,
    callsInternal: calls.internal,
  };
}

export function summarizeModule(source: string, filePath: string, config: ReflectConfig): ModuleSummary {
  const parseErrors: string[] = [];
  let ast: t.File;

  try {
    ast = parseSource(source, filePath, config);
    const errors = (ast as any).errors as Array<{ message: string }> | undefined;
    if (errors?.length) {
      for (const e of errors) parseErrors.push(e.message);
    }
  } catch (err) {
    return {
      filePath,
      moduleKind: "unknown",
      imports: [],
      exports: [],
      declarations: [],
      functions: [],
      classes: [],
      lineCount: source.split("\n").length,
      parseErrors: [(err as Error).message],
    };
  }

  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const declarations: DeclarationInfo[] = [];
  const functions: FunctionSummary[] = [];
  const classes: ClassSummary[] = [];
  let hasESM = false;
  let hasCJS = false;
  const exportedNames = new Set<string>();

  traverse(ast, {
    ImportDeclaration(path: any) {
      hasESM = true;
      const specifiers: ImportSpecifier[] = path.node.specifiers.map((s: any) => {
        if (t.isImportDefaultSpecifier(s)) return { imported: "default", local: s.local.name, kind: "default" as const };
        if (t.isImportNamespaceSpecifier(s)) return { imported: "*", local: s.local.name, kind: "namespace" as const };
        const imp = t.isIdentifier(s.imported) ? s.imported.name : s.imported.value;
        return { imported: imp, local: s.local.name, kind: "named" as const };
      });
      imports.push({ source: path.node.source.value, specifiers, isDynamic: false, loc: toLoc(path.node) });
    },

    ExportDefaultDeclaration(path: any) {
      hasESM = true;
      exportedNames.add("default");
      exports.push({ name: "default", kind: "default", loc: toLoc(path.node) });
      const decl = path.node.declaration;
      if (t.isFunctionDeclaration(decl) || t.isFunctionExpression(decl)) {
        const name = decl.id?.name ?? "(default)";
        functions.push(extractFunctionSummary(name, "function", decl));
      } else if (t.isClassDeclaration(decl)) {
        const name = decl.id?.name ?? "(default)";
        classes.push(extractClass(name, decl));
      }
    },

    ExportNamedDeclaration(path: any) {
      hasESM = true;
      if (path.node.source) {
        for (const spec of path.node.specifiers) {
          const name = t.isIdentifier(spec.exported) ? spec.exported.name : spec.exported.value;
          exportedNames.add(name);
          exports.push({ name, kind: "re-export", source: path.node.source.value, loc: toLoc(path.node) });
        }
      } else if (path.node.specifiers.length) {
        for (const spec of path.node.specifiers) {
          const name = t.isIdentifier(spec.exported) ? spec.exported.name : spec.exported.value;
          exportedNames.add(name);
          exports.push({ name, kind: "named", loc: toLoc(path.node) });
        }
      }
      const decl = path.node.declaration;
      if (decl) {
        if (t.isFunctionDeclaration(decl) && decl.id) {
          exportedNames.add(decl.id.name);
          exports.push({ name: decl.id.name, kind: "named", loc: toLoc(path.node) });
          functions.push(extractFunctionSummary(decl.id.name, "function", decl));
          declarations.push({ name: decl.id.name, kind: "function", exported: true, loc: toLoc(decl) });
        } else if (t.isClassDeclaration(decl) && decl.id) {
          exportedNames.add(decl.id.name);
          exports.push({ name: decl.id.name, kind: "named", loc: toLoc(path.node) });
          classes.push(extractClass(decl.id.name, decl));
          declarations.push({ name: decl.id.name, kind: "class", exported: true, loc: toLoc(decl) });
        } else if (t.isVariableDeclaration(decl)) {
          for (const d of decl.declarations) {
            if (t.isIdentifier(d.id)) {
              exportedNames.add(d.id.name);
              exports.push({ name: d.id.name, kind: "named", loc: toLoc(path.node) });
              declarations.push({ name: d.id.name, kind: decl.kind as "const" | "let" | "var", exported: true, loc: toLoc(d) });
              if (d.init && (t.isFunctionExpression(d.init) || t.isArrowFunctionExpression(d.init))) {
                functions.push(extractFunctionSummary(d.id.name, t.isArrowFunctionExpression(d.init) ? "arrow" : "function", d.init));
              }
            }
          }
        } else if (t.isTSTypeAliasDeclaration(decl) && decl.id) {
          exportedNames.add(decl.id.name);
          exports.push({ name: decl.id.name, kind: "named", loc: toLoc(path.node) });
          declarations.push({ name: decl.id.name, kind: "type", exported: true, loc: toLoc(decl) });
        } else if (t.isTSInterfaceDeclaration(decl) && decl.id) {
          exportedNames.add(decl.id.name);
          exports.push({ name: decl.id.name, kind: "named", loc: toLoc(path.node) });
          declarations.push({ name: decl.id.name, kind: "interface", exported: true, loc: toLoc(decl) });
        } else if (t.isTSEnumDeclaration(decl) && decl.id) {
          exportedNames.add(decl.id.name);
          exports.push({ name: decl.id.name, kind: "named", loc: toLoc(path.node) });
          declarations.push({ name: decl.id.name, kind: "enum", exported: true, loc: toLoc(decl) });
        }
      }
    },

    ExportAllDeclaration(path: any) {
      hasESM = true;
      exports.push({ name: "*", kind: "namespace", source: path.node.source.value, loc: toLoc(path.node) });
    },

    CallExpression(path: any) {
      if (t.isIdentifier(path.node.callee, { name: "require" }) && path.node.arguments.length === 1 && t.isStringLiteral(path.node.arguments[0])) {
        hasCJS = true;
        imports.push({ source: path.node.arguments[0].value, specifiers: [], isDynamic: false, loc: toLoc(path.node) });
      }
      if (t.isImport(path.node.callee) && path.node.arguments.length >= 1 && t.isStringLiteral(path.node.arguments[0])) {
        imports.push({ source: path.node.arguments[0].value, specifiers: [], isDynamic: true, loc: toLoc(path.node) });
      }
    },

    FunctionDeclaration(path: any) {
      if (path.parent && (t.isExportDefaultDeclaration(path.parent) || t.isExportNamedDeclaration(path.parent))) return;
      if (path.node.id) {
        functions.push(extractFunctionSummary(path.node.id.name, "function", path.node));
        declarations.push({ name: path.node.id.name, kind: "function", exported: false, loc: toLoc(path.node) });
      }
    },

    VariableDeclaration(path: any) {
      if (path.parent && (t.isExportNamedDeclaration(path.parent) || !t.isProgram(path.parent))) return;
      for (const d of path.node.declarations) {
        if (t.isIdentifier(d.id)) {
          declarations.push({ name: d.id.name, kind: path.node.kind as "const" | "let" | "var", exported: false, loc: toLoc(d) });
          if (d.init && (t.isFunctionExpression(d.init) || t.isArrowFunctionExpression(d.init))) {
            functions.push(extractFunctionSummary(d.id.name, t.isArrowFunctionExpression(d.init) ? "arrow" : "function", d.init));
          }
        }
      }
    },

    ClassDeclaration(path: any) {
      if (path.parent && (t.isExportDefaultDeclaration(path.parent) || t.isExportNamedDeclaration(path.parent))) return;
      if (path.node.id) {
        classes.push(extractClass(path.node.id.name, path.node));
        declarations.push({ name: path.node.id.name, kind: "class", exported: false, loc: toLoc(path.node) });
      }
    },
  });

  let moduleKind: ModuleKind = "unknown";
  if (hasESM && hasCJS) moduleKind = "mixed";
  else if (hasESM) moduleKind = "esm";
  else if (hasCJS) moduleKind = "cjs";

  // Mark declarations that are exported
  for (const d of declarations) {
    if (exportedNames.has(d.name)) d.exported = true;
  }

  return {
    filePath,
    moduleKind,
    imports,
    exports,
    declarations,
    functions,
    classes,
    lineCount: source.split("\n").length,
    parseErrors,
  };
}

/**
 * Resolve the name of a function path node.
 */
function resolveFunctionName(path: any): string {
  const node = path.node;
  if (t.isFunctionDeclaration(node) && node.id) return node.id.name;
  if (path.parent && t.isVariableDeclarator(path.parent) && t.isIdentifier(path.parent.id)) return path.parent.id.name;
  if (path.parent && t.isObjectProperty(path.parent) && t.isIdentifier(path.parent.key)) return path.parent.key.name;
  return "(anonymous)";
}

/**
 * Analyze closure captures for all (or one named) function(s) in a file.
 * Single-pass scope-aware AST traversal — every ReferencedIdentifier is checked
 * against its binding scope to detect captures from ancestor functions.
 */
export function analyzeClosures(
  source: string,
  filePath: string,
  config: ReflectConfig,
  functionName?: string,
): Array<{ name: string; kind: string; loc: SourceLocation; closureCaptures: ClosureCapture[] }> {
  const ast = parseSource(source, filePath, config);

  // Per-function accumulator: keyed by the function AST node (identity)
  type FuncAcc = {
    name: string;
    kind: string;
    loc: SourceLocation;
    reads: Set<string>;
    writes: Set<string>;
    info: Map<string, { declaredIn: string; declaredLine: number }>;
  };
  const accByNode = new Map<t.Node, FuncAcc>();

  try {
    traverse(ast, {
      ReferencedIdentifier(path: any) {
        const varName: string = path.node.name;

        const binding = path.scope.getBinding(varName);
        if (!binding) return; // global / builtin

        const bindingScope = binding.scope;
        // Find the innermost function scope containing this reference
        const myFuncScope = path.scope.getFunctionParent();
        if (!myFuncScope) return;
        // If the binding is in THIS function's scope, it's local — not a capture
        if (bindingScope === myFuncScope) return;
        // If the binding is at program/module scope, skip
        if (bindingScope.path.isProgram()) return;
        // The binding is in an ancestor function scope — this is a closure capture

        // Walk up to the nearest *named* function scope for attribution.
        // Anonymous callbacks (arrows inside world.on(...)) should attribute
        // their captures to the enclosing named function.
        let attrScope = myFuncScope;
        while (attrScope && resolveFunctionName(attrScope.path) === "(anonymous)") {
          const parentScope = attrScope.parent;
          if (!parentScope || parentScope.path.isProgram()) break;
          const parentFuncScope = parentScope.path.isFunction() ? parentScope : parentScope.getFunctionParent?.();
          if (!parentFuncScope || parentFuncScope === attrScope) break;
          attrScope = parentFuncScope;
        }
        // If the attributed scope IS the binding scope, it's not a capture
        if (attrScope && bindingScope === attrScope) return;

        const funcNode: t.Node = attrScope.path.node;
        let acc = accByNode.get(funcNode);
        if (!acc) {
          const fnPath = attrScope.path;
          const name = resolveFunctionName(fnPath);
          if (functionName && name !== functionName) return;
          acc = {
            name,
            kind: t.isArrowFunctionExpression(funcNode) ? "arrow" : "function",
            loc: toLoc(funcNode as any),
            reads: new Set(),
            writes: new Set(),
            info: new Map(),
          };
          accByNode.set(funcNode, acc);
        } else if (functionName && acc.name !== functionName) {
          return;
        }

        // Record declaration info
        if (!acc.info.has(varName)) {
          let declFuncName = "(anonymous)";
          if (bindingScope.path.isFunction()) {
            declFuncName = resolveFunctionName(bindingScope.path);
          }
          const declLine = binding.path.node?.loc?.start?.line ?? 0;
          acc.info.set(varName, { declaredIn: declFuncName, declaredLine: declLine });
        }

        // Classify read vs write
        const parent = path.parent;
        if (t.isAssignmentExpression(parent) && path.key === "left") {
          acc.writes.add(varName);
        } else if (t.isUpdateExpression(parent)) {
          acc.writes.add(varName);
          acc.reads.add(varName);
        } else if (
          t.isMemberExpression(parent) &&
          parent.object === path.node &&
          t.isIdentifier(parent.property) &&
          MUTATING_METHODS.has(parent.property.name) &&
          path.parentPath?.parent &&
          t.isCallExpression(path.parentPath.parent) &&
          path.parentPath.parent.callee === parent
        ) {
          acc.writes.add(varName);
        } else {
          acc.reads.add(varName);
        }
      },
    });
  } catch {
    return [];
  }

  // If a specific function was requested but had no captures, still include it
  if (functionName && accByNode.size === 0) {
    // Find the function node to get its location
    let found = false;
    traverse(ast, {
      noScope: true,
      "FunctionDeclaration|FunctionExpression|ArrowFunctionExpression"(path: any) {
        if (found) return;
        const name = resolveFunctionName(path);
        if (name === functionName) {
          found = true;
          accByNode.set(path.node, {
            name,
            kind: t.isArrowFunctionExpression(path.node) ? "arrow" : "function",
            loc: toLoc(path.node),
            reads: new Set(),
            writes: new Set(),
            info: new Map(),
          });
        }
      },
    });
  }

  const results: Array<{ name: string; kind: string; loc: SourceLocation; closureCaptures: ClosureCapture[] }> = [];
  for (const acc of accByNode.values()) {
    const captures: ClosureCapture[] = [];
    for (const [varName, info] of acc.info) {
      const isRead = acc.reads.has(varName);
      const isWrite = acc.writes.has(varName);
      const mode: ClosureCapture["mode"] = isRead && isWrite ? "readwrite" : isWrite ? "write" : "read";
      captures.push({ name: varName, mode, declaredIn: info.declaredIn, declaredLine: info.declaredLine });
    }
    captures.sort((a, b) => a.name.localeCompare(b.name));

    if (captures.length > 0 || functionName) {
      results.push({ name: acc.name, kind: acc.kind, loc: acc.loc, closureCaptures: captures });
    }
  }

  return results;
}

function extractClass(name: string, node: t.ClassDeclaration | t.ClassExpression): ClassSummary {
  const methods: FunctionSummary[] = [];
  const properties: string[] = [];

  for (const member of node.body.body) {
    if (t.isClassMethod(member)) {
      const mName = t.isIdentifier(member.key) ? member.key.name : String(member.key);
      const kind = member.kind === "constructor" ? "constructor" as const
        : member.kind === "get" ? "getter" as const
        : member.kind === "set" ? "setter" as const
        : "method" as const;
      methods.push(extractFunctionSummary(mName, kind, member));
    } else if (t.isClassProperty(member) && t.isIdentifier(member.key)) {
      properties.push(member.key.name);
    }
  }

  return {
    name,
    superClass: t.isIdentifier(node.superClass) ? node.superClass.name : null,
    methods,
    properties,
    loc: toLoc(node),
  };
}
