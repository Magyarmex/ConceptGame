# ConceptGame

## Design Docs
See [docs/design/README.md](docs/design/README.md) for the design document index.
See [docs/Debugging.md](docs/Debugging.md) for debug tooling notes.
See [docs/Project-Overview.md](docs/Project-Overview.md) for the project handoff overview.

## Development
```bash
python -m http.server 5173
```

Open `http://localhost:5173/` in a browser. This prototype loads Three.js from a CDN,
so outbound HTTPS access is required.

## Controls
- Drag with the mouse or touch to rotate the camera.
- Move with WASD.
- Jump with Space.
- Move the IK target with the arrow keys, and raise/lower it with R/F.

## Physics + IK Modules
- `src/physics.js` exposes a tiny rigid-body helper with semi-implicit Euler integration,
  capsule-vs-box collision resolution, and grounding updates. Use `integrateBody` followed
  by `resolveCollisions` each frame.
- `src/ik.js` provides a 2-bone FABRIK solver via `solveIK(chain, target, options)` and a
  `buildTwoBoneChain` helper for quick demos or future rigs.

## Debugging
- Append `?debug` to the URL to enable the on-screen debug console.
- Errors and unhandled promise rejections will be captured in the debug console when enabled.
- Live stats (FPS/frame time/draw calls/triangles) appear in the debug console.
- Run `node scripts/test-suite.mjs` for the automated diagnostics suite (file integrity, imports, runtime checks).
- Run `node scripts/report.mjs` for a human-readable summary with next steps.
- Run `node scripts/diagnostics.mjs` to check core file wiring and debug hooks.

## GitHub Pages
- The site is fully static; GitHub Pages should serve `index.html` at the repo root.
- If you see stale assets, bump the cache-busting query strings in `index.html`.
