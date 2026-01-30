# ConceptGame

## Design Docs
See [docs/design/README.md](docs/design/README.md) for the design document index.
See [docs/Debugging.md](docs/Debugging.md) for debug tooling notes.

## Development
```bash
python -m http.server 5173
```

This prototype loads Three.js from a CDN, so outbound HTTPS access is required.

## Controls
- Drag with the mouse or touch to rotate the camera.

## Debugging
- Append `?debug` to the URL to enable the on-screen debug console.
- Errors and unhandled promise rejections will be captured in the debug console when enabled.
- Live stats (FPS/frame time/draw calls/triangles) appear in the debug console.
