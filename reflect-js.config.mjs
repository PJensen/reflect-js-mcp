export default {
  root: ".",
  include: ["**/*.js", "**/*.mjs", "**/*.cjs", "**/*.ts", "**/*.mts", "**/*.cts", "**/*.jsx", "**/*.tsx"],
  exclude: ["node_modules/**", ".git/**", "dist/**", "build/**", "coverage/**", ".next/**", ".turbo/**", ".reflect-js-cache/**"],
  parser: {
    jsx: true,
    typescript: true,
  },
  cache: {
    enabled: true,
    persist: false,
    dir: ".reflect-js-cache",
  },
  watch: false,
  architecturalTags: {},
  bounds: {
    maxReadLines: 200,
    maxListResults: 200,
    maxGraphNodes: 200,
    maxGraphEdges: 400,
  },
};
