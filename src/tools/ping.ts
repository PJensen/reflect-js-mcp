import { toolResult, type ToolResponse } from "../types/tool.js";

export function handlePing(): ToolResponse {
  return toolResult({ ok: true, name: "reflect-js", version: "0.1.0" });
}
