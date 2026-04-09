import fs from "node:fs";
import path from "node:path";
import { clampLines } from "../util/bounds.js";

export interface ExcerptResult {
  filePath: string;
  startLine: number;
  endLine: number;
  totalLines: number;
  content: string;
  truncated: boolean;
}

export function readFileRegion(
  filePath: string,
  root: string,
  startLine: number,
  endLine: number,
  maxLines: number,
): ExcerptResult {
  const abs = path.resolve(root, filePath);
  const content = fs.readFileSync(abs, "utf-8");
  const allLines = content.split("\n");
  const totalLines = allLines.length;

  const [s, e] = clampLines(startLine, Math.min(endLine, totalLines), maxLines);
  const selected = allLines.slice(s - 1, e);
  const truncated = e < endLine || endLine > totalLines;

  const numbered = selected.map((line, i) => `${s + i}\t${line}`).join("\n");

  return {
    filePath,
    startLine: s,
    endLine: s + selected.length - 1,
    totalLines,
    content: numbered,
    truncated,
  };
}
