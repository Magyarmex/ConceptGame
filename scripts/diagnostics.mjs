import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];

function record(name, passed, details = "") {
  results.push({ name, passed, details });
}

function checkFileExists(relativePath) {
  const fullPath = path.join(root, relativePath);
  const exists = fs.existsSync(fullPath);
  record(`exists:${relativePath}`, exists, exists ? "" : "File missing");
  return exists;
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf-8");
}

checkFileExists("index.html");
checkFileExists("src/main.js");
checkFileExists("src/debug.js");
checkFileExists("docs/Debugging.md");

if (fs.existsSync(path.join(root, "index.html"))) {
  const indexHtml = readFile("index.html");
  record("index.html:#app", indexHtml.includes('id="app"'));
  record(
    "index.html:module-script",
    indexHtml.includes('type="module"') && indexHtml.includes("src/main.js")
  );
  record(
    "index.html:cache-bust-v2",
    indexHtml.includes("style.css?v=2") && indexHtml.includes("main.js?v=2")
  );
}

if (fs.existsSync(path.join(root, "src/main.js"))) {
  const mainJs = readFile("src/main.js");
  record("main.js:debug-import", mainJs.includes("createDebugBus"));
  record("main.js:app-mount", mainJs.includes('querySelector("#app")'));
  record(
    "main.js:player-radius-config",
    /radius:\s*\d*\.?\d+/.test(mainJs) &&
      mainJs.includes("radius: playerConfig.radius")
  );
  record(
    "main.js:player-halfheight-uses-radius",
    mainJs.includes("halfHeight: (playerConfig.height - playerConfig.radius * 2) / 2")
  );
  record(
    "main.js:collision-registration-nonempty",
    (mainJs.match(/registerCollisionMesh\(/g) ?? []).length > 1
  );
  record(
    "main.js:collision-volumes-from-registered-meshes",
    mainJs.includes("const collisionVolumes = collisionMeshes.map((mesh) => {")
  );

  record(
    "main.js:inertia-helper-used",
    mainJs.includes("applyPlanarInertia") &&
      mainJs.includes("groundAcceleration") &&
      mainJs.includes("airDrag")
  );
  record(
    "main.js:map-section-builders",
    mainJs.includes("function buildSpawnRoom()") &&
      mainJs.includes("function buildMidLane()") &&
      mainJs.includes("function buildUpperRoute()") &&
      mainJs.includes("function buildFlankRoom()")
  );
  record(
    "main.js:map-section-instantiation",
    mainJs.includes("buildSpawnRoom();") &&
      mainJs.includes("buildMidLane();") &&
      mainJs.includes("buildUpperRoute();") &&
      mainJs.includes("buildFlankRoom();")
  );
  record(
    "main.js:collision-registration-min-count",
    mainJs.includes("const MIN_REGISTERED_COLLIDERS = 9") &&
      mainJs.includes("collisionVolumes.length >= MIN_REGISTERED_COLLIDERS")
  );
  record(
    "main.js:debug-collider-checks",
    mainJs.includes("physics:player-collider-dimensions") &&
      mainJs.includes("physics:static-collider-count")
  );

  record(
    "main.js:look-delta-unified",
    mainJs.includes("applyLookDelta(deltaX, deltaY, cameraState.dragSensitivity)")
  );
  record(
    "main.js:look-sign-convention",
    mainJs.includes("cameraState.yaw += deltaX * sensitivity") &&
      mainJs.includes("cameraState.pitch -= deltaY * sensitivity")
  );
  record(
    "main.js:first-person-free-look-bounds",
    mainJs.includes("minPitch: -Math.PI / 2 + 0.01") &&
      mainJs.includes("maxPitch: Math.PI / 2 - 0.01")
  );
  record(
    "main.js:first-person-look-target",
    mainJs.includes('const lookTarget = cameraState.mode === "first" ? cameraLookTarget : cameraFocus;')
  );

  record(
    "main.js:debug-readability-stats",
    mainJs.includes("grounded: playerBody.onGround") &&
      mainJs.includes("moveSpeed: planarSpeed")
  );

  record(
    "main.js:attack-input-queued",
    mainJs.includes("fireQueued") && mainJs.includes('event.code === "KeyE"')
  );
  record(
    "main.js:combat-shot-handler",
    mainJs.includes("function firePlayerShot()") && mainJs.includes("raycaster.intersectObjects")
  );
  record(
    "main.js:dummy-spawn",
    mainJs.includes("function createDummy(position)") && (mainJs.match(/createDummy\(/g) ?? []).length >= 5
  );
  record(
    "main.js:pickup-loop",
    mainJs.includes("function spawnPickup(position)") && mainJs.includes("combatState.resourceCount += 1")
  );
  record(
    "main.js:resource-counter-visible",
    mainJs.includes("Resources: ${combatState.resourceCount}")
  );
  record(
    "main.js:visual-style-no-orphan-material-references",
    !mainJs.includes("baseMaterial") &&
      !mainJs.includes("columnMaterial") &&
      !mainJs.includes("platformMaterial") &&
      !mainJs.includes("obstacleMaterial") &&
      !mainJs.includes("ramp.material")
  );
  record(
    "main.js:visual-style-map-materials-wired",
    mainJs.includes("mapMaterials.spawn") &&
      mainJs.includes("mapMaterials.mid") &&
      mainJs.includes("mapMaterials.upper") &&
      mainJs.includes("mapMaterials.flank") &&
      mainJs.includes("mapMaterials.cover")
  );

  record(
    "main.js:tutorial-ui-present",
    mainJs.includes("\"Tutorial\\n\"") && mainJs.includes('event.code === "KeyH"')
  );
  record(
    "main.js:crosshair-ui-present",
    mainJs.includes("crosshairHud") && mainJs.includes('crosshairHud.textContent = "+"')
  );
  record(
    "main.js:shot-feedback-message",
    mainJs.includes('showCombatMessage("Miss"') && mainJs.includes('showCombatMessage(dummy.hp <= 0 ? "Target down! Pickup dropped." : "Hit!"')
  );
}

if (fs.existsSync(path.join(root, "src/debug.js"))) {
  const debugJs = readFile("src/debug.js");
  record("debug.js:createDebugBus", debugJs.includes("createDebugBus"));
  record("debug.js:error-handlers", debugJs.includes("unhandledrejection"));
}

const failed = results.filter((entry) => !entry.passed);

console.log("Diagnostics summary:");
results.forEach((entry) => {
  const status = entry.passed ? "PASS" : "FAIL";
  const details = entry.details ? ` (${entry.details})` : "";
  console.log(`- ${status} ${entry.name}${details}`);
});

if (failed.length > 0) {
  console.error(`Diagnostics failed: ${failed.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log("Diagnostics passed.");
}
