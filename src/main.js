import * as THREE from "https://unpkg.com/three@0.168.0/build/three.module.js";
import "./style.css";

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
camera.position.set(0, 1.5, 4);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(3, 5, 2);
scene.add(directionalLight);

const grid = new THREE.GridHelper(20, 20, 0x2b6cb0, 0x1a365d);
scene.add(grid);

const geometry = new THREE.IcosahedronGeometry(1, 0);
const material = new THREE.MeshStandardMaterial({
  color: 0x38bdf8,
  metalness: 0.2,
  roughness: 0.4,
});
const mesh = new THREE.Mesh(geometry, material);
mesh.position.y = 1;
scene.add(mesh);

const clock = new THREE.Clock();

function animate() {
  const elapsed = clock.getElapsedTime();
  mesh.rotation.y = elapsed * 0.6;
  mesh.rotation.x = elapsed * 0.3;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", handleResize);
