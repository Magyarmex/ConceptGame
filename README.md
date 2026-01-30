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
- Press C to toggle between third-person and first-person camera.
- Move the mouse to look around (click to lock the pointer; drag if pointer lock is unavailable).
- Move with WASD.
- Jump with Space.

## Debugging
- Append `?debug` to the URL to enable the on-screen debug console.
- Errors and unhandled promise rejections will be captured in the debug console when enabled.
- Live stats (FPS/frame time/draw calls/triangles) appear in the debug console.

## GitHub Pages
- The site is fully static; GitHub Pages should serve `index.html` at the repo root.
- If you see stale assets, bump the cache-busting query strings in `index.html`.
