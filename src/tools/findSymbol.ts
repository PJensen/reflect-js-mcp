import type { SymbolIndex } from "../core/symbolIndex.js";
import { toolResult, toolError, type ToolResponse } from "../types/tool.js";

export function handleFindSymbol(
  symbolIndex: SymbolIndex,
  args: { symbol: string; kind?: string; pathScope?: string; limit?: number },
): ToolResponse {
  if (!args.symbol || args.symbol.trim() === "") {
    return toolError("INVALID_INPUT", "symbol is required");
  }

  const result = symbolIndex.search(args.symbol, {
    kind: args.kind,
    pathScope: args.pathScope,
    limit: args.limit,
  });

  return toolResult(result);
}
