# AI coding tools

Portable package for agent-centric development workflows.

## Included
- `scripts/test-suite.mjs`
- `scripts/diagnostics.mjs`
- `scripts/report.mjs`
- `scripts/runtime-check.mjs`
- `scripts/agent-dev-workflow.mjs`

These are the canonical implementations. Root-level `scripts/*.mjs` files are thin compatibility wrappers.

## Porting to another repo
1. Copy the `AI coding tools/` folder.
2. Optionally copy root wrapper scripts if you want backwards-compatible command paths.
3. Ensure the target repo has `index.html`, `src/main.js`, and `src/debug.js` checks aligned with your project.
