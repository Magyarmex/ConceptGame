import * as THREE from "https://unpkg.com/three@0.168.0/build/three.module.js";
import { createDebugBus } from "./debug.js";
import {
  createCapsuleCollider,
  createRigidBody,
  integrateBody,
  resolveCollisions,
} from "./physics.js";
import { buildTwoBoneChain, solveIK } from "./ik.js";

const debug = createDebugBus();
const app = document.querySelector("#app");

if (!app) {
  throw new Error("Missing #app element for Three.js mount.");
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x0b0f1a, 1);
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

const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.1);
directionalLight.position.set(3, 5, 2);
scene.add(directionalLight);

const grid = new THREE.GridHelper(20, 20, 0x2b6cb0, 0x1a365d);
scene.add(grid);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const environmentGroup = new THREE.Group();
scene.add(environmentGroup);

const baseGeometry = new THREE.IcosahedronGeometry(1, 0);
const baseMaterial = new THREE.MeshStandardMaterial({
  color: 0x38bdf8,
  metalness: 0.2,
  roughness: 0.4,
});
const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
baseMesh.position.y = 1.2;
baseMesh.position.x = -3.5;
environmentGroup.add(baseMesh);

const columnGeometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
const columnMaterial = new THREE.MeshStandardMaterial({ color: 0x334155 });
const columnOffsets = [
  [-2, 0.9, -2],
  [2, 0.9, -1.5],
  [-1.5, 0.9, 2.2],
];
const collisionMeshes = [];

function registerCollisionMesh(mesh) {
  collisionMeshes.push(mesh);
}

columnOffsets.forEach(([x, y, z]) => {
  const column = new THREE.Mesh(columnGeometry, columnMaterial);
  column.position.set(x, y, z);
  environmentGroup.add(column);
  registerCollisionMesh(column);
});

const platformMaterial = new THREE.MeshStandardMaterial({
  color: 0x1f2937,
  roughness: 0.8,
});
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
  new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 })
);
ramp.position.set(2.5, 0.2, -4.5);
ramp.rotation.z = -Math.PI / 12;
environmentGroup.add(ramp);
registerCollisionMesh(ramp);

const obstacleGeometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
const obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0x0f172a });
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
  new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 })
);
player.position.set(0, 1.2, 0);
scene.add(player);

const playerConfig = {
  moveSpeed: 5,
  jumpSpeed: 6.5,
  gravity: 18,
  damping: 10,
  height: 1.6,
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

const collisionVolumes = collisionMeshes.map((mesh) => ({
  mesh,
  box: new THREE.Box3(),
}));
const floorCollider = {
  box: new THREE.Box3(
    new THREE.Vector3(-10, -0.1, -10),
    new THREE.Vector3(10, 0.1, 10)
  ),
};
const staticColliders = [...collisionVolumes, floorCollider];

const inputState = {
  forward: 0,
  strafe: 0,
  jumpQueued: false,
};

const ikGroup = new THREE.Group();
scene.add(ikGroup);

const rigBase = new THREE.Mesh(
  new THREE.BoxGeometry(0.6, 0.6, 0.6),
  new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.5 })
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
  new THREE.MeshStandardMaterial({ color: 0xe11d48 })
);
ikTarget.position.set(
  rigBase.position.x + 0.8,
  rigBase.position.y + 1.2,
  rigBase.position.z + 0.2
);
ikGroup.add(ikTarget);

const jointGeometry = new THREE.SphereGeometry(0.1, 16, 16);
const jointMaterial = new THREE.MeshStandardMaterial({ color: 0xfde047 });
const jointMeshes = ikChain.joints.map(() => {
  const joint = new THREE.Mesh(jointGeometry, jointMaterial);
  ikGroup.add(joint);
  return joint;
});

const boneGeometry = new THREE.CylinderGeometry(0.06, 0.06, 1, 12);
const boneMaterial = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
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
const targetVelocity = new THREE.Vector3();

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

const updateStaticColliders = () => {
  collisionVolumes.forEach(({ mesh, box }) => {
    mesh.updateWorldMatrix(true, false);
    box.setFromObject(mesh);
  });
};

const clock = new THREE.Clock();
let frameCount = 0;
let statsElapsed = 0;

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

  targetVelocity
    .copy(moveDirection)
    .multiplyScalar(playerConfig.moveSpeed);
  playerBody.velocity.x = THREE.MathUtils.damp(
    playerBody.velocity.x,
    targetVelocity.x,
    playerConfig.damping,
    delta
  );
  playerBody.velocity.z = THREE.MathUtils.damp(
    playerBody.velocity.z,
    targetVelocity.z,
    playerConfig.damping,
    delta
  );

  if (playerBody.onGround && inputState.jumpQueued) {
    playerBody.velocity.y = playerConfig.jumpSpeed;
  }
  inputState.jumpQueued = false;

  integrateBody(playerBody, delta, playerConfig.gravity);
  updateStaticColliders();
  resolveCollisions(playerBody, playerCollider, staticColliders);

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

  renderer.render(scene, camera);

  frameCount += 1;
  statsElapsed += delta;
  if (statsElapsed >= 0.5) {
    const fps = frameCount / statsElapsed;
    const frameTimeMs = (statsElapsed / frameCount) * 1000;
    debug.updateStats({
      fps,
      frameTimeMs,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
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
