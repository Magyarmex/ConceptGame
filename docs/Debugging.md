# Debugging & Error Handling

## Debug Console
- Enable by adding `?debug` to the URL.
- The console overlays on the page and logs structured messages, errors, and renderer capabilities.
- Live stats show FPS, frame time, draw calls, and triangle counts.

## Error Capture
- `window.onerror` and `unhandledrejection` events are captured and stored.
- Logs include timestamps and metadata to help reproduce issues.
- Recent logs and checks are accessible via `window.__CONCEPT_DEBUG__`.
- Error entries include a unique code (e.g. `CG-E001`) and severity level for quick triage.
- Use `window.__CONCEPT_DEBUG__.report()` to print a consistent, human-readable summary of the last error.

## Diagnostics
- Run `node scripts/test-suite.mjs` to run the full automated suite (file integrity, import sanity, runtime checks).
- Run `node scripts/report.mjs` for a human-readable summary with next-step guidance.
- Run `node scripts/runtime-check.mjs` for a focused headless runtime boot check.
- Run `node scripts/diagnostics.mjs` to validate core files and debug wiring.
- The scripts exit non-zero if any checks fail, making them suitable for automation.

### Expected Output
Success:
```\nTest suite summary:\n- PASS file:index.html\n- PASS import:src/main.js->./debug.js\nTotals: 12 passed, 0 failed, 1 warning(s)\n```

Failure:
```\n- FAIL runtime-check:boot (Console errors: 1)\n  Next step: Open the runtime-check output for console error details.\n```

### Error Codes
- `CG-E001` — Unhandled window error.
- `CG-E002` — Unhandled promise rejection.
- `CG-E003` — Debug check failure.
- `CG-E004` — Explicit error logged via `debug.error()`.

## Next Steps
- Add runtime toggles for debug flags via `localStorage` (e.g., `conceptgame:debug`).
