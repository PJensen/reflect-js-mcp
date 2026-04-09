import type { ModuleSummary } from "../types/module.js";
import type { ReflectConfig } from "../types/config.js";

export interface SliceResult {
  files: SliceFile[];
  truncated: boolean;
}

export interface SliceFile {
  filePath: string;
  score: number;
  matchReasons: string[];
}

export function architecturalSlice(
  query: string,
  summaries: Map<string, ModuleSummary>,
  config: ReflectConfig,
  opts: { pathScope?: string; limit?: number } = {},
): SliceResult {
  const limit = opts.limit ?? 20;
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(Boolean);
  const entries: SliceFile[] = [];

  // Check configured architectural tags
  const tagMatches = new Set<string>();
  for (const [tag, keywords] of Object.entries(config.architecturalTags)) {
    if (queryTerms.some((t) => tag.includes(t) || t.includes(tag))) {
      for (const kw of keywords) tagMatches.add(kw.toLowerCase());
    }
  }

  const allTerms = [...new Set([...queryTerms, ...tagMatches])];

  for (const [filePath, summary] of summaries) {
    if (opts.pathScope && !filePath.startsWith(opts.pathScope)) continue;

    let score = 0;
    const reasons: string[] = [];

    // Path matching
    const pathLower = filePath.toLowerCase();
    for (const term of allTerms) {
      if (pathLower.includes(term)) {
        score += 10;
        reasons.push(`path contains "${term}"`);
      }
    }

    // Symbol name matching
    for (const decl of summary.declarations) {
      const declLower = decl.name.toLowerCase();
      for (const term of allTerms) {
        if (declLower.includes(term)) {
          score += 5;
          reasons.push(`declares "${decl.name}" matching "${term}"`);
        }
      }
    }

    // Function name matching
    for (const fn of summary.functions) {
      const fnLower = fn.name.toLowerCase();
      for (const term of allTerms) {
        if (fnLower.includes(term)) {
          score += 5;
          reasons.push(`function "${fn.name}" matches "${term}"`);
        }
      }
    }

    // Import source matching (neighborhood signal)
    for (const imp of summary.imports) {
      const srcLower = imp.source.toLowerCase();
      for (const term of allTerms) {
        if (srcLower.includes(term)) {
          score += 2;
          reasons.push(`imports from "${imp.source}" matching "${term}"`);
        }
      }
    }

    // Export name matching
    for (const exp of summary.exports) {
      const expLower = exp.name.toLowerCase();
      for (const term of allTerms) {
        if (expLower.includes(term)) {
          score += 3;
          reasons.push(`exports "${exp.name}" matching "${term}"`);
        }
      }
    }

    if (score > 0) {
      // Deduplicate reasons
      const uniqueReasons = [...new Set(reasons)];
      entries.push({ filePath, score, matchReasons: uniqueReasons.slice(0, 5) });
    }
  }

  entries.sort((a, b) => b.score - a.score);
  const truncated = entries.length > limit;

  return {
    files: entries.slice(0, limit),
    truncated,
  };
}
