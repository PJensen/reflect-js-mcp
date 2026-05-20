# reflect-js-mcp

`reflect-js-mcp` is a developer-facing MCP server that provides structural reflection for JavaScript and TypeScript repositories.

## What it does

It scans a repo and exposes tools for:

- project and file summaries
- bounded file-region reads
- symbol lookup and module dependency views
- call graph and closure-capture analysis
- architectural and hotspot exploration

## Why it exists

Large codebases are hard for humans and agents to navigate quickly. This server provides compact, bounded, structural context so developer workflows and MCP clients can answer “where is this defined?”, “what depends on this?”, and “what looks risky?” without loading the whole repository.

## How to use

### Install and run locally

```bash
npm ci
npm run build
npm start
```

For development:

```bash
npm run dev
```

The server runs over stdio and can be configured with `reflect-js.config.mjs`.

### Recommended integration: Git submodule

This project is best consumed as a Git submodule in a larger mono-repo/tooling repo so it can be version-pinned and updated intentionally.

```bash
git submodule add https://github.com/PJensen/reflect-js-mcp.git tools/reflect-js-mcp
git submodule update --init --recursive
```

Then build and run from the submodule path.
