import path from "node:path";
import fs from "node:fs";
import type { ReflectConfig } from "../types/config.js";

const DEFAULTS: ReflectConfig = {
  root: ".",
  include: ["**/*.js", "**/*.mjs", "**/*.cjs", "**/*.ts", "**/*.mts", "**/*.cts", "**/*.jsx", "**/*.tsx"],
  exclude: ["node_modules/**", ".git/**", "dist/**", "build/**", "coverage/**", ".next/**", ".turbo/**", ".reflect-js-cache/**"],
  parser: { jsx: true, typescript: true },
  cache: { enabled: true, persist: false, dir: ".reflect-js-cache" },
  watch: false,
  architecturalTags: {},
  bounds: { maxReadLines: 200, maxListResults: 200, maxGraphNodes: 200, maxGraphEdges: 400 },
};

export async function loadConfig(rootOverride?: string): Promise<ReflectConfig> {
  const root = rootOverride ?? process.cwd();
  const configPath = path.resolve(root, "reflect-js.config.mjs");

  let userConfig: Partial<ReflectConfig> = {};
  if (fs.existsSync(configPath)) {
    const mod = await import(`file://${configPath}`);
    userConfig = mod.default ?? mod;
  }

  const config: ReflectConfig = {
    ...DEFAULTS,
    ...userConfig,
    root: path.resolve(rootOverride ?? userConfig.root ?? "."),
    parser: { ...DEFAULTS.parser, ...userConfig.parser },
    cache: { ...DEFAULTS.cache, ...userConfig.cache },
    bounds: { ...DEFAULTS.bounds, ...userConfig.bounds },
  };

  return config;
}
