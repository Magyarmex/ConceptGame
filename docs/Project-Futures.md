# Project Futures

## Camera & Control Ideas
- Add a subtle camera collision/pushback volume to prevent clipping through nearby geometry in tight spaces.
- Offer a per-mode sensitivity slider and invert-Y toggle in an in-game settings panel.
- Add a soft follow camera spring for third-person to emphasize momentum when sprinting or landing.
- Add a left/right camera invert toggle so players can choose their preferred horizontal look direction. (Value: player comfort; Cost: low; Risk: minimal; Validation: toggle and confirm A/D + mouse feel aligns with expectation.)
- Add an on-screen input direction indicator for strafing/turning to validate control mappings quickly during playtests. (Value: faster debugging; Cost: low; Risk: minimal; Validation: verify arrows match actual motion while pressing WASD/moving mouse.)

## Movement & Collision Ideas
- Add a dedicated camera collision volume pass (separate from player collisions) so the camera can smoothly push in without jitter. (Value: cleaner framing in tight spaces; Cost: low-medium; Risk: camera jitter if tuned poorly; Validation: walk near columns/obstacles and confirm no clipping.)
- Upgrade ramp handling to project movement along the ramp plane for smoother ascent/descent. (Value: better readability on slopes; Cost: medium; Risk: edge-case sliding; Validation: walk up/down the ramp and confirm stable grounding.)

## Diagnostics & Tooling Ideas
- Add a lightweight JSON export mode to the diagnostics suite for CI dashboards. (Value: easier CI triage; Cost: low; Risk: minimal; Validation: confirm JSON output parses in CI.)
- Provide a guided troubleshooting wizard that maps common error codes to fixes. (Value: faster onboarding; Cost: low-medium; Risk: outdated guidance; Validation: run through CG-E001/CG-E002 scenarios and confirm guidance accuracy.)
