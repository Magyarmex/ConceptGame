# Debugging & Error Handling

## Debug Console
- Enable by adding `?debug` to the URL.
- The console overlays on the page and logs structured messages, errors, and renderer capabilities.
- Live stats show FPS, frame time, draw calls, and triangle counts.

## Agent Dev Mode
- Enable by adding `?dev` to the URL.
- Dev mode adds:
  - live collider wireframes,
  - occupied-volume overlay rendering,
  - an entity registry panel (entity IDs, tags, transform values),
  - keyboard-driven layout editing with exportable deltas.
- Layout edits persist in localStorage under `conceptgame:layout-deltas`.
- Use `X` to export a JSON delta file (`layout-deltas.json`).

## Scripted Play Harness
- Runtime harness API is available at `window.__CONCEPT_AGENT_HARNESS__`.
- Core methods:
  - `runScenario({ steps })`
  - `getStatus()`
  - `getTrace()`
  - `getEntitySnapshot()`
- Quick smoke path can be launched with `?dev&runScript=smoke`.

## Error Capture
- `window.onerror` and `unhandledrejection` events are captured and stored.
- Logs include timestamps and metadata to help reproduce issues.
- Recent logs and checks are accessible via `window.__CONCEPT_DEBUG__`.
- Error entries include a unique code (e.g. `CG-E001`) and severity level for quick triage.
- Use `window.__CONCEPT_DEBUG__.report()` to print a consistent, human-readable summary of the last error.

## Diagnostics
- Run `node scripts/test-suite.mjs` to run the full automated suite (file integrity, import sanity, runtime checks).
- Run `node scripts/report.mjs` for a human-readable summary with next-step guidance and JSON artifact output.
- Run `node scripts/runtime-check.mjs` for a focused headless runtime boot check.
- Run `node scripts/diagnostics.mjs` to validate core files and debug wiring.
- Run `node scripts/agent-dev-workflow.mjs` to execute test suite + scripted playtest + report generation in one command.
- When Playwright/Puppeteer is available, the workflow drives `window.__CONCEPT_AGENT_HARNESS__` directly and saves real traces; otherwise it emits an explicit skipped-runtime artifact with actionable next steps.
- The scripts exit non-zero if any checks fail, making them suitable for automation.

## Telemetry Artifacts
- Report JSON artifacts are written to `artifacts/reports/`.
- Agent workflow playtest artifacts are written to `artifacts/agent-runs/`.
- Artifact payloads include route completion, collision anomalies, frame-time envelope (min/p50/p95/max), entity snapshots, and summary guidance for next iteration.

### Error Codes
- `CG-E001` — Unhandled window error.
- `CG-E002` — Unhandled promise rejection.
- `CG-E003` — Debug check failure.
- `CG-E004` — Explicit error logged via `debug.error()`.

## Next Steps
- Add additional telemetry channels via `debug.registerTelemetryCollector()` and `debug.publishTelemetry()`.
- Expand scripted scenarios to include combat-focused route branches.
