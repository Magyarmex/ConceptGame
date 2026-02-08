# Project Futures

## Agent Tooling Ideas
- Add click-to-select transform gizmos for dev mode entities (translate/rotate/scale) while keeping keyboard fallback. (Value: faster spatial iteration; Cost: medium; Risk: UI complexity creep; Validation: compare average time-to-adjust 5 colliders before/after.)
- Add scenario packs (`navigation-smoke`, `combat-smoke`, `pickup-loop`) with shared seed handling for deterministic replay. (Value: better regression confidence; Cost: medium; Risk: brittle scripts if map changes; Validation: replay same seed 3 times and compare trace deltas.)
- Add anomaly scoring for contacts (penetration spikes, repeated corner traps) and regression thresholds in CI. (Value: automatic physics health signal; Cost: medium; Risk: false positives until tuned; Validation: inject known bad collider offset and verify threshold breach.)

## Telemetry & Reporting Ideas
- Add frame budget sparkline and per-phase timing (input, physics, render) to report JSON. (Value: clearer perf diagnosis; Cost: medium; Risk: instrumentation overhead; Validation: ensure <2% overhead in local profiling.)
- Add entity diff snapshots between baseline and current run for map-change impact checks. (Value: catches accidental layout drift; Cost: low-medium; Risk: noisy diffs without filters; Validation: move one collider and confirm single-entity diff.)
- Add trend report over last N runs (route completion, anomaly counts, FPS envelope). (Value: supports iterative balancing cadence; Cost: medium; Risk: stale artifacts accumulation; Validation: run workflow 5 times and verify trend output.)
