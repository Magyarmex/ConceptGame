# Future Ideas

A curated list of forward-looking concepts. Only items that are not implemented or not decided belong here.

## Roguelike Perk System (Skill-Multiplying Builds)
- **Goal:** Amplify skill expression with run-scoped perks, without introducing RNG or hard metas.
- **Core idea:** Use deterministic, skill-gated choices rather than random pools.

### Deterministic Selection (No RNG)
- Fixed milestone choices (e.g., after objectives or time intervals).
- Performance-gated unlocks (headshot streaks, perfect dodges, clean ability chains).
- Objective-driven unlocks (map control enables specific perk branches).

### Skill-Triggered Effects
- Aim: headshot streaks trigger short team focus-fire boosts.
- Movement: perfect dodge grants brief speed and minion rally.
- Timing: ability chains after kills grant cooldown refunds.

### Meta-Resistance Without Manual Balancing
- Hard category caps (only one mobility, one burst, one control perk).
- Built-in counterplay: perks must create visible weaknesses.
- Sidegrades over raw upgrades to avoid clear best-in-slot picks.

### Open Questions
- **OPEN:** How to ensure perk choices feel meaningful without RNG.
- **OPEN:** Whether perks remain PvE-only or are allowed in PvP.

## Self-Hosted Three.js Bundle
- **Goal:** Remove CDN reliance by vendoring a pinned Three.js module build in the repo.
- **Value:** GitHub Pages works offline and local development is not blocked by outbound HTTPS restrictions.
- **Risk:** Requires manual updates when Three.js is upgraded.
- **Validation:** Confirm local static server loads without external network access.

## Automated Visual Smoke Test
- **Goal:** Add a script to capture a headless screenshot after launching the static server.
- **Value:** Quick signal that the scene renders on GitHub Pages-style hosting.
- **Risk:** Requires a headless browser runtime in CI.
- **Validation:** Store a snapshot artifact and compare for regression.

## Next Direction (29/01/26 — GPT-5.2-Codex #1)
- **Add player controller stub:** WASD movement, jump, and capsule collider with simple ground checks.
- **Input + camera cleanup:** centralize pointer/keyboard input handling and smooth camera damping.
- **Scene composition pass:** replace primitives with low-poly placeholders for player, enemies, and cover.
- **Performance baseline:** add a frame time budget checklist and capture initial metrics in debug overlay.
- **Local dev quality-of-life:** add a small “launch server + open URL” script for contributors.
