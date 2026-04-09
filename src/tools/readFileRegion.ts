import { readFileRegion } from "../core/excerpts.js";
import { assertInsideRoot } from "../util/paths.js";
import { fileExists } from "../core/repo.js";
import { toolResult, toolError, type ToolResponse } from "../types/tool.js";
import type { BoundsConfig } from "../types/config.js";

export function handleReadFileRegion(
  root: string,
  bounds: BoundsConfig,
  args: { filePath: string; startLine?: number; endLine?: number; maxLines?: number },
): ToolResponse {
  try {
    const rel = assertInsideRoot(args.filePath, root);
    if (!fileExists(rel, root)) {
      return toolError("FILE_NOT_FOUND", `No file found at ${args.filePath}`, { filePath: args.filePath });
    }

    const startLine = args.startLine ?? 1;
    const maxLines = Math.min(args.maxLines ?? bounds.maxReadLines, bounds.maxReadLines);
    const endLine = args.endLine ?? startLine + maxLines - 1;

    const result = readFileRegion(rel, root, startLine, endLine, maxLines);
    return toolResult(result);
  } catch (err) {
    if ((err as { code?: string }).code === "PATH_OUTSIDE_ROOT") {
      return toolError("PATH_OUTSIDE_ROOT", (err as Error).message);
    }
    throw err;
  }
}
