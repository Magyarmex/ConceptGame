# Project Overview & Handoff

This document summarizes the current repo structure, runtime behavior, and debugging
tooling so a new agent can pick up development without losing context.

## What Runs Today
- **Entry point:** `index.html` (repo root).
- **Main scene:** `src/main.js` sets up a Three.js scene with a baseplate, grid, and
  rotatable camera.
- **Styles:** `src/style.css` (loaded via `<link>` in `index.html`).
- **Debug tools:** `src/debug.js` (on-screen console with metrics and error capture).

## Scene Features
- Base scene includes a floor plane, grid helper, central icosahedron, and columns.
- Camera is orbit-style: click/touch drag to rotate around a target.
- Rotation limits clamp pitch to avoid flipping.

## Debugging & Metrics
- Add `?debug` to the URL to show the debug overlay.
- Debug overlay logs errors, unhandled rejections, and renderer capabilities.
- Live stats: FPS, frame time, draw calls, and triangle counts.

## Local Development
```bash
python -m http.server 5173
```
Open `http://localhost:5173/`.

## Hosting Notes (GitHub Pages)
- Static hosting expects `index.html` at the repo root.
- `index.html` references `./src/main.js` and `./src/style.css`.
- Cache-busting query strings are used (`?v=1`) to avoid stale assets.

## Repo Map
- `index.html` – static entry point (script + stylesheet).
- `src/main.js` – base scene + camera controls + animation loop.
- `src/debug.js` – debug console + error capture + metrics.
- `src/style.css` – layout + background styling.
- `docs/Debugging.md` – debug usage notes.
- `docs/design/` – design documentation and future ideas.

## Known Constraints
- Three.js is loaded from a CDN (requires outbound HTTPS).
- In restricted environments, CDN access may fail; see Future Ideas for self-hosting.
