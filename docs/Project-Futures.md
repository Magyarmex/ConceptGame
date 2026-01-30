# Project Futures

## Camera & Control Ideas
- Add a subtle camera collision/pushback volume to prevent clipping through nearby geometry in tight spaces.
- Offer a per-mode sensitivity slider and invert-Y toggle in an in-game settings panel.
- Add a soft follow camera spring for third-person to emphasize momentum when sprinting or landing.
- Add a left/right camera invert toggle so players can choose their preferred horizontal look direction. (Value: player comfort; Cost: low; Risk: minimal; Validation: toggle and confirm A/D + mouse feel aligns with expectation.)

## Movement & Collision Ideas
- Add a dedicated camera collision volume pass (separate from player collisions) so the camera can smoothly push in without jitter. (Value: cleaner framing in tight spaces; Cost: low-medium; Risk: camera jitter if tuned poorly; Validation: walk near columns/obstacles and confirm no clipping.)
- Upgrade ramp handling to project movement along the ramp plane for smoother ascent/descent. (Value: better readability on slopes; Cost: medium; Risk: edge-case sliding; Validation: walk up/down the ramp and confirm stable grounding.)
