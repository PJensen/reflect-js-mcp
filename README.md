# reflect-js-mcp

`reflect-js-mcp` is a developer-facing MCP server that provides structural reflection for JavaScript and TypeScript repositories.

## What it does

It scans a repo and exposes tools for:

- project and file summaries
- bounded file-region reads
- symbol lookup and module dependency views
- call graph and closure-capture analysis
- architectural and hotspot exploration

## Available tools

- `ping` — Health check.
- `project_summary` — Top-level repo information.
- `list_project_files` — Bounded file listing with optional glob/prefix filtering.
- `read_file_region` — Read a bounded code excerpt by path and line range.
- `reflect_module` — Structural summary of one module (imports/exports/declarations/functions/classes).
- `reflect_functions` — Function-level structural summaries for one file.
- `find_symbol` — Locate symbol definitions across the indexed codebase.
- `module_graph` — Bounded dependency graph centered on a file or subtree.
- `call_graph` — Static call graph hints for a file or function.
- `hotspots` — Rank structurally important or risky code locations.
- `architectural_slice` — Best-effort subsystem slice for a concern.
- `closure_captures` — Analyze closure variable captures for functions in a file.
- `refresh_index` — Re-scan the repo and invalidate stale cache entries.

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
