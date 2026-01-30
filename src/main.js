import * as THREE from "https://unpkg.com/three@0.168.0/build/three.module.js";
import { createDebugBus } from "./debug.js";

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

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const cameraState = {
  radius: 7,
  yaw: Math.PI * 0.25,
  pitch: Math.PI * 0.15,
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
});

const ramp = new THREE.Mesh(
  new THREE.BoxGeometry(4, 0.4, 2.4),
  new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 })
);
ramp.position.set(2.5, 0.2, -4.5);
ramp.rotation.z = -Math.PI / 12;
environmentGroup.add(ramp);

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
});

const player = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.45, 1.1, 6, 12),
  new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 })
);
player.position.set(0, 1.2, 0);
scene.add(player);

const playerState = {
  velocity: new THREE.Vector3(),
  moveSpeed: 5,
  jumpSpeed: 6.5,
  gravity: 18,
  damping: 10,
  onGround: false,
  height: 1.6,
};

player.position.y = playerState.height / 2;
playerState.onGround = true;

const inputState = {
  forward: 0,
  strafe: 0,
  jumpQueued: false,
};

const cameraFocus = new THREE.Vector3();
const cameraDesired = new THREE.Vector3();
const cameraLook = new THREE.Vector3();

function updateCameraPosition(delta) {
  const { radius, yaw, pitch } = cameraState;
  cameraFocus.copy(player.position);
  cameraFocus.y += playerState.height * 0.6;

  const x = radius * Math.cos(pitch) * Math.cos(yaw);
  const z = radius * Math.cos(pitch) * Math.sin(yaw);
  const y = radius * Math.sin(pitch);
  cameraDesired.set(cameraFocus.x + x, cameraFocus.y + y, cameraFocus.z + z);

  camera.position.lerp(cameraDesired, 1 - Math.exp(-delta * 8));
  cameraLook.lerp(cameraFocus, 1 - Math.exp(-delta * 10));
  camera.lookAt(cameraLook);
}

const clock = new THREE.Clock();
let frameCount = 0;
let statsElapsed = 0;

function animate() {
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;
  baseMesh.rotation.y = elapsed * 0.6;
  baseMesh.rotation.x = elapsed * 0.3;

  const forward = new THREE.Vector3(
    Math.cos(cameraState.yaw),
    0,
    Math.sin(cameraState.yaw)
  );
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const moveDirection = new THREE.Vector3();
  moveDirection
    .addScaledVector(forward, inputState.forward)
    .addScaledVector(right, inputState.strafe);
  if (moveDirection.lengthSq() > 0) {
    moveDirection.normalize();
  }

  playerState.velocity.x = moveDirection.x * playerState.moveSpeed;
  playerState.velocity.z = moveDirection.z * playerState.moveSpeed;
  if (moveDirection.lengthSq() === 0) {
    playerState.velocity.x = THREE.MathUtils.damp(
      playerState.velocity.x,
      0,
      playerState.damping,
      delta
    );
    playerState.velocity.z = THREE.MathUtils.damp(
      playerState.velocity.z,
      0,
      playerState.damping,
      delta
    );
  }

  playerState.velocity.y -= playerState.gravity * delta;
  if (playerState.onGround) {
    if (inputState.jumpQueued) {
      playerState.velocity.y = playerState.jumpSpeed;
      playerState.onGround = false;
    } else {
      playerState.velocity.y = Math.max(playerState.velocity.y, 0);
    }
  }
  inputState.jumpQueued = false;

  player.position.addScaledVector(playerState.velocity, delta);
  const groundY = playerState.height / 2;
  if (player.position.y <= groundY) {
    player.position.y = groundY;
    playerState.velocity.y = 0;
    playerState.onGround = true;
  }

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
  cameraState.yaw -= deltaX * sensitivity;
  cameraState.pitch += deltaY * sensitivity;
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
      cameraConfig.sensitivity
    );
    return;
  }

  if (!pointerState.isDragging) {
    return;
  }

  const deltaX = event.clientX - pointerState.lastPointer.x;
  const deltaY = event.clientY - pointerState.lastPointer.y;
  pointerState.lastPointer = { x: event.clientX, y: event.clientY };

  cameraState.yaw -= deltaX * 0.005;
  cameraState.pitch += deltaY * 0.005;
  cameraState.pitch = Math.max(-1.2, Math.min(1.2, cameraState.pitch));
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
});
