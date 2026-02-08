# Project Futures

## Combat Readability Ideas
- Add a lightweight center reticle that briefly expands on confirmed hits. (Value: clearer shot confirmation; Cost: low; Risk: visual clutter if oversized; Validation: verify users can distinguish hit vs miss in a 30-second playtest.)
- Add a tiny floating `+1` resource text when a pickup is collected. (Value: stronger reward readability; Cost: low; Risk: spam during rapid pickups; Validation: collect 5 pickups and ensure text is legible but fades quickly.)
- Add an optional miss indicator spark at max range when a shot does not hit a dummy. (Value: preserves aiming feedback on misses; Cost: low; Risk: noisy effects; Validation: fire into empty space and confirm one short-lived marker appears.)

## Encounter Iteration Ideas
- Add timed dummy respawn points with a visible cooldown ring. (Value: repeatable loop testing; Cost: medium; Risk: pacing confusion; Validation: defeat dummy and confirm deterministic respawn timing.)
- Add two dummy archetypes (stationary and slow strafing) to test aim tracking. (Value: improves skill-expression testing; Cost: medium; Risk: early AI complexity creep; Validation: compare hit-rate variance across both archetypes.)

## Economy & Progression Ideas
- Add a spend sink in debug UI (e.g., spend 5 resources to spawn a practice wave). (Value: validates gather/spend loop early; Cost: low-medium; Risk: placeholder tuning noise; Validation: gather resources, spend threshold, and verify deterministic outcome.)
- Add per-run resource stats in the debug panel (shots fired, hits, pickups collected). (Value: faster balancing iteration; Cost: low; Risk: stat drift if counters reset incorrectly; Validation: run one session and verify counters match observed actions.)
