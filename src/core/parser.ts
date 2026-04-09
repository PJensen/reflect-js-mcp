import { parse, type ParserOptions } from "@babel/parser";
import type * as t from "@babel/types";
import type { ReflectConfig } from "../types/config.js";

export function parseSource(source: string, filePath: string, config: ReflectConfig): t.File {
  const plugins: ParserOptions["plugins"] = ["decorators", "classProperties", "classPrivateProperties", "classPrivateMethods", "topLevelAwait", "importAssertions", "importAttributes", "explicitResourceManagement"];

  if (config.parser.typescript || /\.tsx?$/.test(filePath)) {
    plugins.push("typescript");
  }
  if (config.parser.jsx || /\.[jt]sx$/.test(filePath)) {
    plugins.push("jsx");
  }

  return parse(source, {
    sourceType: "unambiguous",
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction: true,
    allowSuperOutsideMethod: true,
    plugins,
    errorRecovery: true,
  });
}
