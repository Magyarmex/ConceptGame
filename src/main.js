import * as THREE from "https://unpkg.com/three@0.168.0/build/three.module.js";
import { createDebugBus } from "./debug.js";
import {
  createCapsuleCollider,
  createRigidBody,
  integrateBody,
  resolveCollisions,
  applyPlanarInertia,
} from "./physics.js";
import { buildTwoBoneChain, solveIK } from "./ik.js";

const debug = createDebugBus();
const app = document.querySelector("#app");
const urlParams = new URLSearchParams(window.location.search);

if (!app) {
  throw new Error("Missing #app element for Three.js mount.");
}

const VISUAL_THEMES = {
  legacy: {
    clearColor: 0x0b0f1a,
    lights: { ambient: 0.45, directional: 1.1 },
    grid: { center: 0x2b6cb0, lines: 0x1a365d },
    materials: {
      floor: { color: 0x111827, roughness: 0.9, metalness: 0.05, emissive: 0x000000, emissiveIntensity: 0 },
      base: { color: 0x38bdf8, roughness: 0.4, metalness: 0.2, emissive: 0x000000, emissiveIntensity: 0 },
      column: { color: 0x334155, roughness: 0.8, metalness: 0.1, emissive: 0x000000, emissiveIntensity: 0 },
      platform: { color: 0x1f2937, roughness: 0.8, metalness: 0.1, emissive: 0x000000, emissiveIntensity: 0 },
      ramp: { color: 0x475569, roughness: 0.7, metalness: 0.1, emissive: 0x000000, emissiveIntensity: 0 },
      obstacle: { color: 0x0f172a, roughness: 0.9, metalness: 0.05, emissive: 0x000000, emissiveIntensity: 0 },
      player: { color: 0xf97316, roughness: 0.4, metalness: 0.05, emissive: 0x000000, emissiveIntensity: 0 },
      enemy: { color: 0xdc2626, roughness: 0.5, metalness: 0.05, emissive: 0x000000, emissiveIntensity: 0 },
      pickup: { color: 0x22d3ee, roughness: 0.35, metalness: 0.15, emissive: 0x164e63, emissiveIntensity: 0.6 },
      impact: { color: 0xf8fafc, roughness: 0.3, metalness: 0.05, emissive: 0x475569, emissiveIntensity: 0.35 },
      rigBase: { color: 0x22c55e, roughness: 0.5, metalness: 0.05, emissive: 0x000000, emissiveIntensity: 0 },
      ikTarget: { color: 0xe11d48, roughness: 0.45, metalness: 0.05, emissive: 0x000000, emissiveIntensity: 0 },
      joint: { color: 0xfde047, roughness: 0.5, metalness: 0.05, emissive: 0x000000, emissiveIntensity: 0 },
      bone: { color: 0x94a3b8, roughness: 0.65, metalness: 0.1, emissive: 0x000000, emissiveIntensity: 0 },
    },
    enemyFlashColor: 0xfef08a,
  },
  styled: {
    clearColor: 0x080b10,
    lights: { ambient: 0.7, directional: 0.62 },
    grid: { center: 0x1f2a3a, lines: 0x141b27 },
    materials: {
      floor: { color: 0x111824, roughness: 1, metalness: 0, emissive: 0x05080d, emissiveIntensity: 0.28 },
      base: { color: 0x1f2937, roughness: 1, metalness: 0, emissive: 0x0f172a, emissiveIntensity: 0.2 },
      column: { color: 0x273244, roughness: 1, metalness: 0, emissive: 0x0e1620, emissiveIntensity: 0.14 },
      platform: { color: 0x1c2636, roughness: 1, metalness: 0, emissive: 0x0c1420, emissiveIntensity: 0.2 },
      ramp: { color: 0x2d3a4c, roughness: 1, metalness: 0, emissive: 0x101924, emissiveIntensity: 0.16 },
      obstacle: { color: 0x0f1724, roughness: 1, metalness: 0, emissive: 0x080d16, emissiveIntensity: 0.25 },
      player: { color: 0xffffff, roughness: 0.95, metalness: 0, emissive: 0x43e8ff, emissiveIntensity: 0.16 },
      enemy: { color: 0xff2f2f, roughness: 0.95, metalness: 0, emissive: 0x670f15, emissiveIntensity: 0.42 },
      pickup: { color: 0x69e2ff, roughness: 0.9, metalness: 0, emissive: 0x105f73, emissiveIntensity: 0.78 },
      impact: { color: 0xffffff, roughness: 0.9, metalness: 0, emissive: 0x7dd3fc, emissiveIntensity: 0.58 },
      rigBase: { color: 0x5a677a, roughness: 1, metalness: 0, emissive: 0x1b2534, emissiveIntensity: 0.18 },
      ikTarget: { color: 0xff4d6d, roughness: 0.95, metalness: 0, emissive: 0x530f26, emissiveIntensity: 0.34 },
      joint: { color: 0xb7c5dd, roughness: 0.95, metalness: 0, emissive: 0x1f2c42, emissiveIntensity: 0.16 },
      bone: { color: 0x7a8ca8, roughness: 1, metalness: 0, emissive: 0x1b2538, emissiveIntensity: 0.15 },
    },
    enemyFlashColor: 0xfff3c6,
  },
};

const styleState = {
  mode: urlParams.has("legacyStyle") ? "legacy" : "styled",
};

function createSceneMaterial(slot) {
  return new THREE.MeshStandardMaterial({ ...VISUAL_THEMES[styleState.mode].materials[slot] });
}

function applyMaterialPreset(material, slot) {
  const preset = VISUAL_THEMES[styleState.mode].materials[slot];
  material.color.setHex(preset.color);
  material.roughness = preset.roughness;
  material.metalness = preset.metalness;
  material.emissive.setHex(preset.emissive);
  material.emissiveIntensity = preset.emissiveIntensity;
  material.needsUpdate = true;
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(VISUAL_THEMES[styleState.mode].clearColor, 1);
app.appendChild(renderer.domElement);
debug.check("renderer:context", Boolean(renderer.getContext()));

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
debug.check("scene:initialized", Boolean(scene && camera));

const cameraState = {
  radius: 7,
  yaw: Math.PI * 0.25,
  pitch: Math.PI * 0.15,
  mode: "third",
  thirdPerson: {
    minPitch: -0.35,
    maxPitch: 1.1,
  },
  firstPerson: {
    minPitch: -Math.PI / 2 + 0.01,
    maxPitch: Math.PI / 2 - 0.01,
  },
  sensitivity: 0.0025,
  dragSensitivity: 0.005,
};

const ambientLight = new THREE.AmbientLight(0xffffff, VISUAL_THEMES[styleState.mode].lights.ambient);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, VISUAL_THEMES[styleState.mode].lights.directional);
directionalLight.position.set(3, 5, 2);
scene.add(directionalLight);

const grid = new THREE.GridHelper(
  20,
  20,
  VISUAL_THEMES[styleState.mode].grid.center,
  VISUAL_THEMES[styleState.mode].grid.lines
);
scene.add(grid);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  createSceneMaterial("floor")
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const environmentGroup = new THREE.Group();
scene.add(environmentGroup);

const baseGeometry = new THREE.IcosahedronGeometry(1, 0);
const baseMaterial = createSceneMaterial("base");
const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
baseMesh.position.y = 1.2;
baseMesh.position.x = -3.5;
environmentGroup.add(baseMesh);

const columnGeometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
const columnMaterial = createSceneMaterial("column");
const columnOffsets = [
  [-2, 0.9, -2],
  [2, 0.9, -1.5],
  [-1.5, 0.9, 2.2],
];
const collisionMeshes = [];
const MIN_REGISTERED_COLLIDERS = 9;
const colliderDebugHelpers = [];

function createColliderDebugHelper(localBox) {
  const size = localBox.getSize(new THREE.Vector3());
  const center = localBox.getCenter(new THREE.Vector3());
  const helper = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)),
    new THREE.LineBasicMaterial({ color: 0x22d3ee })
  );
  helper.matrixAutoUpdate = false;
  helper.visible = debug.enabled;
  helper.userData.center = center;
  return helper;
}

function registerCollisionMesh(mesh) {
  collisionMeshes.push(mesh);
}

columnOffsets.forEach(([x, y, z]) => {
  const column = new THREE.Mesh(columnGeometry, columnMaterial);
  column.position.set(x, y, z);
  environmentGroup.add(column);
  registerCollisionMesh(column);
});

const platformMaterial = createSceneMaterial("platform");
const platformGeometry = new THREE.BoxGeometry(3.5, 0.4, 3.5);
const platforms = [
  { position: new THREE.Vector3(4, 0.2, 3) },
  { position: new THREE.Vector3(-4, 0.2, -3.5) },
];
platforms.forEach(({ position }) => {
  const platform = new THREE.Mesh(platformGeometry, platformMaterial);
  platform.position.copy(position);
  environmentGroup.add(platform);
  registerCollisionMesh(platform);
});

const ramp = new THREE.Mesh(
  new THREE.BoxGeometry(4, 0.4, 2.4),
  createSceneMaterial("ramp")
);
ramp.position.set(2.5, 0.2, -4.5);
ramp.rotation.z = -Math.PI / 12;
environmentGroup.add(ramp);
registerCollisionMesh(ramp);

const obstacleGeometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
const obstacleMaterial = createSceneMaterial("obstacle");
[
  new THREE.Vector3(0, 0.6, -4),
  new THREE.Vector3(1.8, 0.6, 1.2),
  new THREE.Vector3(-2.2, 0.6, 1.4),
].forEach((position) => {
  const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
  obstacle.position.copy(position);
  environmentGroup.add(obstacle);
  registerCollisionMesh(obstacle);
});

const player = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.45, 1.1, 6, 12),
  createSceneMaterial("player")
);
player.position.set(0, 1.2, 0);
scene.add(player);

const playerConfig = {
  moveSpeed: 5.2,
  jumpSpeed: 6.5,
  gravity: 18,
  groundAcceleration: 32,
  airAcceleration: 9,
  groundDrag: 16,
  airDrag: 2.2,
  height: 2,
  radius: 0.45,
};

const playerBody = createRigidBody({
  position: new THREE.Vector3(0, playerConfig.height / 2, 0),
  velocity: new THREE.Vector3(),
  gravityScale: 1,
});

const playerCollider = createCapsuleCollider({
  radius: playerConfig.radius,
  halfHeight: (playerConfig.height - playerConfig.radius * 2) / 2,
});

player.position.copy(playerBody.position);

const collisionVolumes = collisionMeshes.map((mesh) => {
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox.clone();
  const debugHelper = createColliderDebugHelper(box);
  scene.add(debugHelper);
  colliderDebugHelpers.push({ mesh, helper: debugHelper, center: box.getCenter(new THREE.Vector3()) });
  return {
    mesh,
    box,
    worldMatrix: new THREE.Matrix4(),
    inverseWorldMatrix: new THREE.Matrix4(),
  };
});
const floorCollider = {
  box: new THREE.Box3(
    new THREE.Vector3(-10, -0.1, -10),
    new THREE.Vector3(10, 0.1, 10)
  ),
  worldMatrix: new THREE.Matrix4(),
  inverseWorldMatrix: new THREE.Matrix4(),
};
const staticColliders = [...collisionVolumes, floorCollider];

debug.check("physics:player-collider-dimensions",
  Number.isFinite(playerCollider.radius) &&
    Number.isFinite(playerCollider.halfHeight) &&
    playerCollider.radius > 0 &&
    playerCollider.halfHeight > 0
);
debug.check("physics:static-collider-count", collisionVolumes.length >= MIN_REGISTERED_COLLIDERS, {
  count: collisionVolumes.length,
  expectedMinimum: MIN_REGISTERED_COLLIDERS,
});

const inputState = {
  forward: 0,
  strafe: 0,
  jumpQueued: false,
  fireQueued: false,
};

const combatState = {
  resourceCount: 0,
  fireCooldown: 0,
  message: "Aim at a dummy and fire.",
  messageTimer: 2.4,
  hitsLanded: 0,
  shotsFired: 0,
  tutorialVisible: true,
};

const combatHud = document.createElement("div");
combatHud.style.position = "fixed";
combatHud.style.left = "12px";
combatHud.style.top = "12px";
combatHud.style.padding = "8px 10px";
combatHud.style.background = "rgba(15, 23, 42, 0.85)";
combatHud.style.color = "#e2e8f0";
combatHud.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
combatHud.style.fontSize = "12px";
combatHud.style.border = "1px solid rgba(148, 163, 184, 0.4)";
combatHud.style.borderRadius = "8px";
combatHud.style.pointerEvents = "none";
combatHud.style.zIndex = "9999";
app.appendChild(combatHud);

const tutorialHud = document.createElement("div");
tutorialHud.style.position = "fixed";
tutorialHud.style.left = "12px";
tutorialHud.style.top = "58px";
tutorialHud.style.padding = "8px 10px";
tutorialHud.style.background = "rgba(2, 6, 23, 0.82)";
tutorialHud.style.color = "#cbd5e1";
tutorialHud.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
tutorialHud.style.fontSize = "12px";
tutorialHud.style.lineHeight = "1.35";
tutorialHud.style.border = "1px solid rgba(100, 116, 139, 0.4)";
tutorialHud.style.borderRadius = "8px";
tutorialHud.style.pointerEvents = "none";
tutorialHud.style.zIndex = "9999";
app.appendChild(tutorialHud);

const feedbackHud = document.createElement("div");
feedbackHud.style.position = "fixed";
feedbackHud.style.left = "50%";
feedbackHud.style.bottom = "20px";
feedbackHud.style.transform = "translateX(-50%)";
feedbackHud.style.padding = "8px 12px";
feedbackHud.style.background = "rgba(15, 23, 42, 0.82)";
feedbackHud.style.color = "#f8fafc";
feedbackHud.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
feedbackHud.style.fontSize = "12px";
feedbackHud.style.border = "1px solid rgba(148, 163, 184, 0.4)";
feedbackHud.style.borderRadius = "8px";
feedbackHud.style.pointerEvents = "none";
feedbackHud.style.zIndex = "9999";
app.appendChild(feedbackHud);

const crosshairHud = document.createElement("div");
crosshairHud.style.position = "fixed";
crosshairHud.style.left = "50%";
crosshairHud.style.top = "50%";
crosshairHud.style.transform = "translate(-50%, -50%)";
crosshairHud.style.color = "rgba(226, 232, 240, 0.9)";
crosshairHud.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
crosshairHud.style.fontSize = "20px";
crosshairHud.style.fontWeight = "600";
crosshairHud.style.pointerEvents = "none";
crosshairHud.style.textShadow = "0 0 10px rgba(15, 23, 42, 0.8)";
crosshairHud.style.zIndex = "9999";
crosshairHud.textContent = "+";
app.appendChild(crosshairHud);

const styleHud = document.createElement("div");
styleHud.style.position = "fixed";
styleHud.style.right = "12px";
styleHud.style.top = "12px";
styleHud.style.padding = "6px 10px";
styleHud.style.background = "rgba(2, 6, 23, 0.78)";
styleHud.style.color = "#dbeafe";
styleHud.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
styleHud.style.fontSize = "11px";
styleHud.style.border = "1px solid rgba(125, 211, 252, 0.32)";
styleHud.style.borderRadius = "8px";
styleHud.style.pointerEvents = "none";
styleHud.style.zIndex = "9999";
app.appendChild(styleHud);

function updateStyleHud() {
  styleHud.textContent = `Style: ${styleState.mode.toUpperCase()} (V to toggle)`;
}

updateStyleHud();

function showCombatMessage(message, duration = 1) {
  combatState.message = message;
  combatState.messageTimer = duration;
  feedbackHud.textContent = message;
}

function updateCombatHud() {
  combatHud.textContent = `Resources: ${combatState.resourceCount}  |  Hits: ${combatState.hitsLanded}/${combatState.shotsFired}`;
  tutorialHud.style.display = combatState.tutorialVisible ? "block" : "none";
  tutorialHud.textContent =
    "Tutorial\n" +
    "- Aim with camera + center crosshair\n" +
    "- Fire: Left Click or E\n" +
    "- Collect dropped pickups by walking over them\n" +
    "- Press H to hide/show this help";
}

updateCombatHud();
showCombatMessage(combatState.message, combatState.messageTimer);

const dummyGroup = new THREE.Group();
scene.add(dummyGroup);

const dummyGeometry = new THREE.CylinderGeometry(0.35, 0.35, 1.6, 12);
const pickupGeometry = new THREE.OctahedronGeometry(0.2, 0);
const impactGeometry = new THREE.SphereGeometry(0.08, 8, 8);
const raycaster = new THREE.Raycaster();
const cameraAim = new THREE.Vector2(0, 0);
const attackOrigin = new THREE.Vector3();
const pickupOffset = new THREE.Vector3(0, 0.2, 0);

const dummies = [];
const pickups = [];
const impactMarkers = [];

function createDummy(position) {
  const mesh = new THREE.Mesh(
    dummyGeometry,
    createSceneMaterial("enemy")
  );
  mesh.position.copy(position);
  mesh.position.y = 0.8;
  dummyGroup.add(mesh);
  dummies.push({
    mesh,
    hp: 2,
    flashTimer: 0,
    defeated: false,
    baseColor: new THREE.Color(VISUAL_THEMES[styleState.mode].materials.enemy.color),
    flashColor: new THREE.Color(VISUAL_THEMES[styleState.mode].enemyFlashColor),
  });
}

function spawnPickup(position) {
  const mesh = new THREE.Mesh(
    pickupGeometry,
    createSceneMaterial("pickup")
  );
  mesh.position.copy(position).add(pickupOffset);
  scene.add(mesh);
  pickups.push({ mesh, spinOffset: Math.random() * Math.PI * 2 });
}

function spawnImpactMarker(position) {
  const marker = new THREE.Mesh(
    impactGeometry,
    createSceneMaterial("impact")
  );
  marker.position.copy(position);
  scene.add(marker);
  impactMarkers.push({ mesh: marker, ttl: 0.14 });
}

function firePlayerShot() {
  camera.getWorldPosition(attackOrigin);
  raycaster.setFromCamera(cameraAim, camera);
  combatState.shotsFired += 1;

  const activeDummies = dummies.filter((dummy) => !dummy.defeated).map((dummy) => dummy.mesh);
  const hits = raycaster.intersectObjects(activeDummies, false);
  if (hits.length === 0) {
    showCombatMessage("Miss", 0.45);
    updateCombatHud();
    return;
  }

  const hit = hits[0];
  const dummy = dummies.find((entry) => entry.mesh === hit.object);
  if (!dummy || dummy.defeated) {
    showCombatMessage("Miss", 0.45);
    updateCombatHud();
    return;
  }

  dummy.hp -= 1;
  dummy.flashTimer = 0.15;
  combatState.hitsLanded += 1;
  spawnImpactMarker(hit.point);
  showCombatMessage(dummy.hp <= 0 ? "Target down! Pickup dropped." : "Hit!", 0.7);

  if (dummy.hp <= 0) {
    dummy.defeated = true;
    dummy.mesh.visible = false;
    spawnPickup(dummy.mesh.position);
  }

  updateCombatHud();
}

createDummy(new THREE.Vector3(2.5, 0, 0.6));
createDummy(new THREE.Vector3(3.7, 0, -1.5));
createDummy(new THREE.Vector3(1.8, 0, -2.2));

const ikGroup = new THREE.Group();
scene.add(ikGroup);

const rigBase = new THREE.Mesh(
  new THREE.BoxGeometry(0.6, 0.6, 0.6),
  createSceneMaterial("rigBase")
);
rigBase.position.set(-3, 1.5, 3.2);
ikGroup.add(rigBase);

const ikRoot = new THREE.Vector3(
  rigBase.position.x,
  rigBase.position.y + 0.6,
  rigBase.position.z
);
const ikChain = buildTwoBoneChain(ikRoot, 0.8, 0.8);
const ikTarget = new THREE.Mesh(
  new THREE.SphereGeometry(0.12, 16, 16),
  createSceneMaterial("ikTarget")
);
ikTarget.position.set(
  rigBase.position.x + 0.8,
  rigBase.position.y + 1.2,
  rigBase.position.z + 0.2
);
ikGroup.add(ikTarget);

const jointGeometry = new THREE.SphereGeometry(0.1, 16, 16);
const jointMaterial = createSceneMaterial("joint");
const jointMeshes = ikChain.joints.map(() => {
  const joint = new THREE.Mesh(jointGeometry, jointMaterial);
  ikGroup.add(joint);
  return joint;
});

const boneGeometry = new THREE.CylinderGeometry(0.06, 0.06, 1, 12);
const boneMaterial = createSceneMaterial("bone");
const boneMeshes = [0, 1].map(() => {
  const bone = new THREE.Mesh(boneGeometry, boneMaterial);
  ikGroup.add(bone);
  return bone;
});

const ikTargetState = {
  forward: 0,
  strafe: 0,
  lift: 0,
  speed: 1.2,
};

function updateBoneMesh(mesh, start, end) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  mesh.position.copy(start).addScaledVector(direction, 0.5);
  if (length > 0) {
    direction.normalize();
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction
    );
  }
  mesh.scale.set(1, length, 1);
}

const cameraFocus = new THREE.Vector3();
const cameraDesired = new THREE.Vector3();
const cameraLook = new THREE.Vector3();
const cameraLookTarget = new THREE.Vector3();
const cameraForward = new THREE.Vector3();
const movementForward = new THREE.Vector3();
const movementRight = new THREE.Vector3();
const moveDirection = new THREE.Vector3();

function clampPitch(value, mode) {
  const limits =
    mode === "first" ? cameraState.firstPerson : cameraState.thirdPerson;
  return Math.max(limits.minPitch, Math.min(limits.maxPitch, value));
}

function updateCameraVectors(yaw, pitch) {
  const cosPitch = Math.cos(pitch);
  cameraForward.set(
    Math.cos(yaw) * cosPitch,
    Math.sin(pitch),
    Math.sin(yaw) * cosPitch
  );
}

function updateCameraPosition(delta) {
  const { radius, yaw, pitch } = cameraState;
  const headOffset = playerConfig.height * 0.85;
  cameraFocus.copy(playerBody.position);
  cameraFocus.y += headOffset;

  updateCameraVectors(yaw, pitch);

  if (cameraState.mode === "first") {
    cameraDesired.copy(cameraFocus);
    cameraLookTarget.copy(cameraForward).multiplyScalar(6).add(cameraDesired);
  } else {
    const cameraYaw = yaw + Math.PI;
    const x = radius * Math.cos(pitch) * Math.cos(cameraYaw);
    const z = radius * Math.cos(pitch) * Math.sin(cameraYaw);
    const y = radius * Math.sin(pitch);
    cameraDesired.set(cameraFocus.x + x, cameraFocus.y + y, cameraFocus.z + z);
    cameraLookTarget.copy(cameraFocus);
  }

  const lookTarget = cameraState.mode === "first" ? cameraLookTarget : cameraFocus;

  camera.position.lerp(cameraDesired, 1 - Math.exp(-delta * 8));
  cameraLook.lerp(lookTarget, 1 - Math.exp(-delta * 10));
  camera.lookAt(cameraLook);
}

const tempColliderMatrix = new THREE.Matrix4();

const updateStaticColliders = () => {
  collisionVolumes.forEach((collider) => {
    collider.mesh.updateWorldMatrix(true, false);
    collider.worldMatrix.copy(collider.mesh.matrixWorld);
    collider.inverseWorldMatrix.copy(collider.worldMatrix).invert();
  });

  colliderDebugHelpers.forEach(({ mesh, helper, center }) => {
    tempColliderMatrix.makeTranslation(center.x, center.y, center.z);
    helper.matrix.multiplyMatrices(mesh.matrixWorld, tempColliderMatrix);
    helper.visible = debug.enabled;
  });
};

const clock = new THREE.Clock();
let frameCount = 0;
let statsElapsed = 0;

function applyVisualStyle(mode) {
  if (!VISUAL_THEMES[mode]) {
    return;
  }
  styleState.mode = mode;
  const theme = VISUAL_THEMES[mode];
  renderer.setClearColor(theme.clearColor, 1);
  ambientLight.intensity = theme.lights.ambient;
  directionalLight.intensity = theme.lights.directional;
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
  if (gridMaterials[0]) {
    gridMaterials[0].color.setHex(theme.grid.center);
    gridMaterials[0].needsUpdate = true;
  }
  if (gridMaterials[1]) {
    gridMaterials[1].color.setHex(theme.grid.lines);
    gridMaterials[1].needsUpdate = true;
  }

  [
    [floor.material, "floor"],
    [baseMaterial, "base"],
    [columnMaterial, "column"],
    [platformMaterial, "platform"],
    [ramp.material, "ramp"],
    [obstacleMaterial, "obstacle"],
    [player.material, "player"],
    [rigBase.material, "rigBase"],
    [ikTarget.material, "ikTarget"],
    [jointMaterial, "joint"],
    [boneMaterial, "bone"],
  ].forEach(([material, slot]) => applyMaterialPreset(material, slot));

  dummies.forEach((dummy) => {
    applyMaterialPreset(dummy.mesh.material, "enemy");
    dummy.baseColor.setHex(theme.materials.enemy.color);
    dummy.flashColor.setHex(theme.enemyFlashColor);
  });

  pickups.forEach((pickup) => {
    applyMaterialPreset(pickup.mesh.material, "pickup");
  });

  impactMarkers.forEach((marker) => {
    applyMaterialPreset(marker.mesh.material, "impact");
  });

  updateStyleHud();
}

applyVisualStyle(styleState.mode);

function animate() {
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;
  baseMesh.rotation.y = elapsed * 0.6;
  baseMesh.rotation.x = elapsed * 0.3;

  movementForward.set(
    Math.cos(cameraState.yaw),
    0,
    Math.sin(cameraState.yaw)
  );
  movementRight.set(-movementForward.z, 0, movementForward.x);
  moveDirection
    .set(0, 0, 0)
    .addScaledVector(movementForward, inputState.forward)
    .addScaledVector(movementRight, inputState.strafe);
  if (moveDirection.lengthSq() > 0) {
    moveDirection.normalize();
  }

  applyPlanarInertia(playerBody, moveDirection, delta, {
    maxSpeed: playerConfig.moveSpeed,
    groundAcceleration: playerConfig.groundAcceleration,
    airAcceleration: playerConfig.airAcceleration,
    groundDrag: playerConfig.groundDrag,
    airDrag: playerConfig.airDrag,
  });

  if (playerBody.onGround && inputState.jumpQueued) {
    playerBody.velocity.y = playerConfig.jumpSpeed;
  }
  inputState.jumpQueued = false;

  integrateBody(playerBody, delta, playerConfig.gravity);
  updateStaticColliders();
  resolveCollisions(playerBody, playerCollider, staticColliders);

  combatState.fireCooldown = Math.max(0, combatState.fireCooldown - delta);
  if (inputState.fireQueued && combatState.fireCooldown <= 0) {
    firePlayerShot();
    combatState.fireCooldown = 0.18;
  }
  inputState.fireQueued = false;

  player.position.copy(playerBody.position);
  player.rotation.y = Math.PI / 2 - cameraState.yaw;

  ikTarget.position.x += ikTargetState.strafe * ikTargetState.speed * delta;
  ikTarget.position.z += ikTargetState.forward * ikTargetState.speed * delta;
  ikTarget.position.y += ikTargetState.lift * ikTargetState.speed * delta;
  ikTarget.position.y = THREE.MathUtils.clamp(
    ikTarget.position.y,
    0.6,
    3.2
  );

  const ikResult = solveIK(
    { joints: ikChain.joints },
    ikTarget.position,
    { iterations: 6, tolerance: 0.002 }
  );
  ikResult.joints.forEach((joint, index) => {
    jointMeshes[index].position.copy(joint);
  });
  updateBoneMesh(boneMeshes[0], ikResult.joints[0], ikResult.joints[1]);
  updateBoneMesh(boneMeshes[1], ikResult.joints[1], ikResult.joints[2]);

  updateCameraPosition(delta);

  dummies.forEach((dummy) => {
    if (dummy.flashTimer > 0) {
      dummy.flashTimer = Math.max(0, dummy.flashTimer - delta);
    }
    const intensity = dummy.flashTimer > 0 ? dummy.flashTimer / 0.15 : 0;
    dummy.mesh.material.color.copy(dummy.baseColor).lerp(dummy.flashColor, intensity);
  });

  for (let index = pickups.length - 1; index >= 0; index -= 1) {
    const pickup = pickups[index];
    pickup.mesh.rotation.y += delta * 2.6;
    pickup.mesh.position.y = 0.35 + Math.sin(elapsed * 3 + pickup.spinOffset) * 0.08;
    if (pickup.mesh.position.distanceTo(playerBody.position) < 1) {
      scene.remove(pickup.mesh);
      pickups.splice(index, 1);
      combatState.resourceCount += 1;
      showCombatMessage(`Resource +1 (total ${combatState.resourceCount})`, 1);
      updateCombatHud();
    }
  }

  for (let index = impactMarkers.length - 1; index >= 0; index -= 1) {
    const marker = impactMarkers[index];
    marker.ttl -= delta;
    if (marker.ttl <= 0) {
      scene.remove(marker.mesh);
      impactMarkers.splice(index, 1);
      continue;
    }
    marker.mesh.scale.setScalar(1 + (0.14 - marker.ttl) * 5);
  }

  if (combatState.messageTimer > 0) {
    combatState.messageTimer = Math.max(0, combatState.messageTimer - delta);
    if (combatState.messageTimer === 0) {
      feedbackHud.textContent = "";
    }
  }

  renderer.render(scene, camera);

  frameCount += 1;
  statsElapsed += delta;
  if (statsElapsed >= 0.5) {
    const fps = frameCount / statsElapsed;
    const frameTimeMs = (statsElapsed / frameCount) * 1000;
    const planarSpeed = Math.hypot(playerBody.velocity.x, playerBody.velocity.z);
    debug.updateStats({
      fps,
      frameTimeMs,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      grounded: playerBody.onGround,
      moveSpeed: planarSpeed,
    });
    frameCount = 0;
    statsElapsed = 0;
  }

  requestAnimationFrame(animate);
}

animate();

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", handleResize);

const pointerState = {
  isDragging: false,
  isPointerLocked: false,
  lastPointer: { x: 0, y: 0 },
};

function applyLookDelta(deltaX, deltaY, sensitivity) {
  cameraState.yaw += deltaX * sensitivity;
  cameraState.pitch -= deltaY * sensitivity;
  cameraState.pitch = clampPitch(cameraState.pitch, cameraState.mode);
}

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return;
  }

  pointerState.isDragging = true;
  pointerState.lastPointer = { x: event.clientX, y: event.clientY };
  inputState.fireQueued = true;
  renderer.domElement.setPointerCapture(event.pointerId);

  if (renderer.domElement.requestPointerLock) {
    renderer.domElement.requestPointerLock();
  }
});

renderer.domElement.addEventListener("pointerup", (event) => {
  if (event.button !== 0) {
    return;
  }

  pointerState.isDragging = false;
  renderer.domElement.releasePointerCapture(event.pointerId);
});

renderer.domElement.addEventListener("pointerleave", () => {
  pointerState.isDragging = false;
});

document.addEventListener("pointerlockchange", () => {
  pointerState.isPointerLocked =
    document.pointerLockElement === renderer.domElement;
});

renderer.domElement.addEventListener("pointermove", (event) => {
  if (pointerState.isPointerLocked) {
    applyLookDelta(
      event.movementX,
      event.movementY,
      cameraState.sensitivity
    );
    return;
  }

  if (!pointerState.isDragging) {
    return;
  }

  const deltaX = event.clientX - pointerState.lastPointer.x;
  const deltaY = event.clientY - pointerState.lastPointer.y;
  pointerState.lastPointer = { x: event.clientX, y: event.clientY };

  applyLookDelta(deltaX, deltaY, cameraState.dragSensitivity);
});

debug.attachRenderer(renderer);

window.addEventListener("keydown", (event) => {
  if (event.repeat) {
    return;
  }

  if (event.code === "KeyW") {
    inputState.forward = 1;
  }
  if (event.code === "KeyS") {
    inputState.forward = -1;
  }
  if (event.code === "KeyA") {
    inputState.strafe = -1;
  }
  if (event.code === "KeyD") {
    inputState.strafe = 1;
  }
  if (event.code === "Space") {
    inputState.jumpQueued = true;
  }
  if (event.code === "KeyC") {
    cameraState.mode = cameraState.mode === "third" ? "first" : "third";
    cameraState.pitch = clampPitch(cameraState.pitch, cameraState.mode);
  }
  if (event.code === "ArrowUp") {
    ikTargetState.forward = 1;
  }
  if (event.code === "ArrowDown") {
    ikTargetState.forward = -1;
  }
  if (event.code === "ArrowLeft") {
    ikTargetState.strafe = -1;
  }
  if (event.code === "ArrowRight") {
    ikTargetState.strafe = 1;
  }
  if (event.code === "KeyR") {
    ikTargetState.lift = 1;
  }
  if (event.code === "KeyF") {
    ikTargetState.lift = -1;
  }
  if (event.code === "KeyE") {
    inputState.fireQueued = true;
  }
  if (event.code === "KeyH") {
    combatState.tutorialVisible = !combatState.tutorialVisible;
    updateCombatHud();
  }
  if (event.code === "KeyV") {
    applyVisualStyle(styleState.mode === "styled" ? "legacy" : "styled");
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "KeyW" && inputState.forward === 1) {
    inputState.forward = 0;
  }
  if (event.code === "KeyS" && inputState.forward === -1) {
    inputState.forward = 0;
  }
  if (event.code === "KeyA" && inputState.strafe === -1) {
    inputState.strafe = 0;
  }
  if (event.code === "KeyD" && inputState.strafe === 1) {
    inputState.strafe = 0;
  }
  if (event.code === "ArrowUp" && ikTargetState.forward === 1) {
    ikTargetState.forward = 0;
  }
  if (event.code === "ArrowDown" && ikTargetState.forward === -1) {
    ikTargetState.forward = 0;
  }
  if (event.code === "ArrowLeft" && ikTargetState.strafe === -1) {
    ikTargetState.strafe = 0;
  }
  if (event.code === "ArrowRight" && ikTargetState.strafe === 1) {
    ikTargetState.strafe = 0;
  }
  if (event.code === "KeyR" && ikTargetState.lift === 1) {
    ikTargetState.lift = 0;
  }
  if (event.code === "KeyF" && ikTargetState.lift === -1) {
    ikTargetState.lift = 0;
  }
});
