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
- Fire a basic shot with left click or E.
- Toggle the combat tutorial overlay with H.
- Press V to toggle between the legacy look and the styled high-contrast visual pass.
- Append `?legacyStyle` to load directly into the legacy visual mode for side-by-side review.
- Move the IK target with the arrow keys, and raise/lower it with R/F.

### Dev Mode Controls (`?dev`)
- `B` toggles live collision wireframe overlays.
- `O` toggles occupied-volume overlays.
- `N/P` cycles selected static collider volume.
- `I/J/K/L` move selected collider on X/Z.
- `U` and `;` move selected collider on Y.
- `,` and `.` rotate selected collider around Y.
- `-` and `=` scale selected collider.
- `X` exports current layout deltas to JSON and localStorage.

## Physics + IK Modules
- `src/physics.js` exposes a tiny rigid-body helper with semi-implicit Euler integration,
  capsule-vs-box collision resolution, and grounding updates. Use `integrateBody` followed
  by `resolveCollisions` each frame.
- `src/ik.js` provides a 2-bone FABRIK solver via `solveIK(chain, target, options)` and a
  `buildTwoBoneChain` helper for quick demos or future rigs.

## Debugging
- AI coding environment tooling is bundled under `AI coding tools/` for portability across repositories.
- Append `?debug` to the URL to enable the on-screen debug console and collider wireframes.
- Append `?dev` to enable the in-scene dev HUD, entity registry panel, and layout editing workflow.
- Append `?dev&runScript=smoke` to auto-run the built-in scripted smoke path.
- Errors and unhandled promise rejections will be captured in the debug console when enabled.
- Live stats (FPS/frame time/draw calls/triangles) appear in the debug console.
- Run `node scripts/test-suite.mjs` for the automated diagnostics suite (file integrity, imports, runtime checks).
- Run `node scripts/report.mjs` for a human-readable summary with next steps + JSON artifact.
- Run `node scripts/diagnostics.mjs` to check core file wiring and debug hooks.
- Run `node scripts/agent-dev-workflow.mjs` for one-command test suite + scripted playtest + report generation (real harness traces when Playwright/Puppeteer is available).


## Map Layout (Shooter Prototype)
- The map is now a compact multi-zone layout with a spawn room, mid lane, upper route, and flank room.
- Vertical traversal includes an upper ramp route and a stair-step connector for looped movement.
- Targets are distributed across near/mid/far lanes, with elevated and flank pressure positions for engagement choice testing.
- Use `?debug` or `?dev` to confirm collider occupancy aligns with rendered map geometry.

## GitHub Pages
- The site is fully static; GitHub Pages should serve `index.html` at the repo root.
- If you see stale assets, bump the cache-busting query strings in `index.html` (currently `?v=2` for both CSS and JS).
