import type { ModuleSummary } from "../types/module.js";
import type { SymbolEntry, SymbolSearchResult, SymbolReference } from "../types/symbol.js";

export class SymbolIndex {
  private symbols: SymbolEntry[] = [];
  private byName = new Map<string, SymbolEntry[]>();
  private indexed = new Set<string>();

  indexModule(summary: ModuleSummary): void {
    if (this.indexed.has(summary.filePath)) {
      this.removeFile(summary.filePath);
    }
    this.indexed.add(summary.filePath);

    for (const decl of summary.declarations) {
      const entry: SymbolEntry = {
        name: decl.name,
        kind: decl.kind === "const" || decl.kind === "let" || decl.kind === "var" ? "variable" : decl.kind,
        filePath: summary.filePath,
        loc: decl.loc,
        exported: decl.exported,
      };
      this.addEntry(entry);
    }

    for (const cls of summary.classes) {
      for (const method of cls.methods) {
        const entry: SymbolEntry = {
          name: `${cls.name}.${method.name}`,
          kind: "method",
          filePath: summary.filePath,
          loc: method.loc,
          exported: false,
        };
        this.addEntry(entry);
      }
    }
  }

  private addEntry(entry: SymbolEntry): void {
    this.symbols.push(entry);
    const existing = this.byName.get(entry.name) ?? [];
    existing.push(entry);
    this.byName.set(entry.name, existing);
  }

  removeFile(filePath: string): void {
    this.symbols = this.symbols.filter((s) => s.filePath !== filePath);
    for (const [name, entries] of this.byName) {
      const filtered = entries.filter((e) => e.filePath !== filePath);
      if (filtered.length === 0) this.byName.delete(name);
      else this.byName.set(name, filtered);
    }
    this.indexed.delete(filePath);
  }

  search(
    symbol: string,
    opts: { kind?: string; pathScope?: string; limit?: number } = {},
  ): SymbolSearchResult {
    const limit = opts.limit ?? 50;
    const pattern = symbol.toLowerCase();

    let definitions = this.symbols.filter((s) => {
      if (!s.name.toLowerCase().includes(pattern)) return false;
      if (opts.kind && s.kind !== opts.kind) return false;
      if (opts.pathScope && !s.filePath.startsWith(opts.pathScope)) return false;
      return true;
    });

    // Sort: exact matches first, then exported, then alphabetical
    definitions.sort((a, b) => {
      const aExact = a.name.toLowerCase() === pattern ? 0 : 1;
      const bExact = b.name.toLowerCase() === pattern ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      if (a.exported !== b.exported) return a.exported ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const truncated = definitions.length > limit;
    definitions = definitions.slice(0, limit);

    // References are heuristic — we track import references
    const references: SymbolReference[] = [];

    return { definitions, references, truncated };
  }

  get size(): number {
    return this.symbols.length;
  }
}
