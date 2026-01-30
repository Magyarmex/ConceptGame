# Debugging & Error Handling

## Debug Console
- Enable by adding `?debug` to the URL.
- The console overlays on the page and logs structured messages, errors, and renderer capabilities.
- Live stats show FPS, frame time, draw calls, and triangle counts.

## Error Capture
- `window.onerror` and `unhandledrejection` events are captured and stored.
- Logs include timestamps and metadata to help reproduce issues.
- Recent logs and checks are accessible via `window.__CONCEPT_DEBUG__`.

## Diagnostics
- Run `node scripts/diagnostics.mjs` to validate core files and debug wiring.
- The diagnostics script exits non-zero if any checks fail, making it suitable for automation.

## Next Steps
- Add runtime toggles for debug flags via `localStorage` (e.g., `conceptgame:debug`).
