# Debugging & Error Handling

## Debug Console
- Enable by adding `?debug` to the URL.
- The console overlays on the page and logs structured messages, errors, and renderer capabilities.
- Live stats show FPS, frame time, draw calls, and triangle counts.

## Error Capture
- `window.onerror` and `unhandledrejection` events are logged when debug mode is enabled.
- Logs include timestamps and metadata to help reproduce issues.

## Next Steps
- Add runtime toggles for debug flags via `localStorage` (e.g., `conceptgame:debug`).
