import * as THREE from "https://unpkg.com/three@0.168.0/build/three.module.js";
import "./style.css";
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
  radius: 6,
  yaw: Math.PI * 0.25,
  pitch: Math.PI * 0.15,
  target: new THREE.Vector3(0, 1, 0),
};

function updateCameraPosition() {
  const { radius, yaw, pitch, target } = cameraState;
  const x = radius * Math.cos(pitch) * Math.cos(yaw);
  const z = radius * Math.cos(pitch) * Math.sin(yaw);
  const y = radius * Math.sin(pitch);
  camera.position.set(target.x + x, target.y + y, target.z + z);
  camera.lookAt(target);
}

updateCameraPosition();

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

const baseGeometry = new THREE.IcosahedronGeometry(1, 0);
const baseMaterial = new THREE.MeshStandardMaterial({
  color: 0x38bdf8,
  metalness: 0.2,
  roughness: 0.4,
});
const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
baseMesh.position.y = 1.2;
scene.add(baseMesh);

const columnGeometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
const columnMaterial = new THREE.MeshStandardMaterial({ color: 0x334155 });
const columnOffsets = [
  [-2, 0.9, -2],
  [2, 0.9, -1.5],
  [-1.5, 0.9, 2.2],
];

columnOffsets.forEach(([x, y, z]) => {
  const column = new THREE.Mesh(columnGeometry, columnMaterial);
  column.position.set(x, y, z);
  scene.add(column);
});

const clock = new THREE.Clock();
let frameCount = 0;
let statsElapsed = 0;

function animate() {
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;
  baseMesh.rotation.y = elapsed * 0.6;
  baseMesh.rotation.x = elapsed * 0.3;

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

let isDragging = false;
let lastPointer = { x: 0, y: 0 };

renderer.domElement.addEventListener("pointerdown", (event) => {
  isDragging = true;
  lastPointer = { x: event.clientX, y: event.clientY };
  renderer.domElement.setPointerCapture(event.pointerId);
});

renderer.domElement.addEventListener("pointerup", (event) => {
  isDragging = false;
  renderer.domElement.releasePointerCapture(event.pointerId);
});

renderer.domElement.addEventListener("pointerleave", () => {
  isDragging = false;
});

renderer.domElement.addEventListener("pointermove", (event) => {
  if (!isDragging) {
    return;
  }

  const deltaX = event.clientX - lastPointer.x;
  const deltaY = event.clientY - lastPointer.y;
  lastPointer = { x: event.clientX, y: event.clientY };

  cameraState.yaw -= deltaX * 0.005;
  cameraState.pitch -= deltaY * 0.005;
  cameraState.pitch = Math.max(-1.2, Math.min(1.2, cameraState.pitch));
  updateCameraPosition();
});

debug.attachRenderer(renderer);
