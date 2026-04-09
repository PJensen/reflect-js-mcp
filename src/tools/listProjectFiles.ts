// @ts-expect-error picomatch lacks type declarations
import picomatch from "picomatch";
import type { RepoInventory } from "../core/repo.js";
import type { BoundsConfig } from "../types/config.js";
import { paginate } from "../util/bounds.js";
import { toolResult, type ToolResponse } from "../types/tool.js";

export function handleListProjectFiles(
  inventory: RepoInventory,
  bounds: BoundsConfig,
  args: { pathPrefix?: string; glob?: string; limit?: number; offset?: number },
): ToolResponse {
  let files = inventory.files;

  if (args.pathPrefix) {
    const prefix = args.pathPrefix;
    files = files.filter((f) => f.startsWith(prefix));
  }

  if (args.glob) {
    const isMatch = picomatch(args.glob);
    files = files.filter((f) => isMatch(f));
  }

  const limit = Math.min(args.limit ?? bounds.maxListResults, bounds.maxListResults);
  const offset = args.offset ?? 0;
  const result = paginate(files, limit, offset);

  return toolResult({
    files: result.items,
    total: result.total,
    offset,
    limit,
    truncated: result.truncated,
  });
}
