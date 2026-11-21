import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createAnimeMascot } from './anime-mascot.js';

const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
const setStatus = (text) => { statusEl.textContent = text; };

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1117);

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;

// Toon materials need lights. A soft key and a cool fill keep the cel bands clean.
scene.add(new THREE.HemisphereLight(0xdfeaff, 0x3a3f4a, 1.4));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(3, 5, 4);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -3;
key.shadow.camera.right = 3;
key.shadow.camera.top = 3;
key.shadow.camera.bottom = -3;
key.shadow.normalBias = 0.02;
scene.add(key);
const fill = new THREE.DirectionalLight(0x9fc4ff, 0.5);
fill.position.set(-4, 2, 2);
scene.add(fill);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(5, 64),
  new THREE.MeshStandardMaterial({ color: 0x121a22, roughness: 1 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const mascot = createAnimeMascot();
scene.add(mascot.root);

const FRAMES = {
  full: { distance: 4.0, targetY: 0.85, fov: 34 },
  medium: { distance: 2.9, targetY: 1.12, fov: 32 },
  close: { distance: 1.9, targetY: 1.45, fov: 30 },
};
let transition = null;

function setFrame(name, instant = false) {
  const f = FRAMES[name];
  if (!f) return;
  document.querySelectorAll('#framing button').forEach((b) => b.classList.toggle('active', b.dataset.frame === name));
  const boost = Math.max(1, 0.75 / camera.aspect);
  const to = {
    position: new THREE.Vector3(0, f.targetY + 0.05, f.distance * boost),
    target: new THREE.Vector3(0, f.targetY, 0),
    fov: f.fov,
  };
  if (instant) {
    camera.position.copy(to.position);
    controls.target.copy(to.target);
    camera.fov = to.fov;
    camera.updateProjectionMatrix();
    transition = null;
  } else {
    transition = {
      t: 0, duration: 0.5, to,
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      fromFov: camera.fov,
    };
  }
  setStatus(`Framing: ${name}`);
}

function setBackground(mode) {
  const transparent = mode === 'transparent';
  scene.background = transparent ? null : new THREE.Color(mode === 'light' ? 0xeef2f6 : 0x0d1117);
  floor.visible = !transparent;
  document.body.classList.toggle('bg-transparent', transparent);
  document.querySelectorAll('#background button').forEach((b) => b.classList.toggle('active', b.dataset.bg === mode));
  setStatus(`Background: ${mode}`);
}

function setState(name) {
  if (!mascot.setState(name)) return;
  document.querySelectorAll('#states button').forEach((b) => b.classList.toggle('active', b.dataset.state === name));
  setStatus(`State: ${name}`);
}

document.querySelectorAll('#states button').forEach((b) => b.addEventListener('click', () => setState(b.dataset.state)));
document.querySelectorAll('#framing button').forEach((b) => b.addEventListener('click', () => setFrame(b.dataset.frame)));
document.querySelectorAll('#background button').forEach((b) => b.addEventListener('click', () => setBackground(b.dataset.bg)));
document.getElementById('ui-toggle').addEventListener('click', () => setUI(document.body.classList.contains('hide-ui')));

function setUI(v) { document.body.classList.toggle('hide-ui', !v); }

const keys = ['idle', 'thinking', 'speaking', 'waving', 'error'];
window.addEventListener('keydown', (e) => {
  if (e.key >= '1' && e.key <= '5') setState(keys[Number(e.key) - 1]);
  else if (e.key.toLowerCase() === 'h') setUI(document.body.classList.contains('hide-ui'));
});

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

setFrame('medium', true);
const params = new URLSearchParams(location.search);
if (params.get('ui') === '0') setUI(false);
if (params.get('frame')) setFrame(params.get('frame'), true);
if (params.get('bg')) setBackground(params.get('bg'));
if (params.get('state')) setState(params.get('state'));

window.animeMascot = {
  ready: true,
  state: (name) => setState(name),
  frame: (name) => setFrame(name),
  background: (mode) => setBackground(mode),
  ui: (v) => setUI(v),
  blink: () => mascot.blink(),
  captureFrame: () => renderer.domElement.toDataURL('image/png'),
};
window.dispatchEvent(new CustomEvent('mascot:ready'));

const timer = new THREE.Timer();
timer.connect(document);
renderer.setAnimationLoop(() => {
  timer.update();
  const dt = timer.getDelta();
  const t = timer.getElapsed();
  mascot.update(dt, t);

  if (transition) {
    transition.t += dt;
    const p = Math.min(transition.t / transition.duration, 1);
    const e = p * p * (3 - 2 * p);
    camera.position.lerpVectors(transition.fromPos, transition.to.position, e);
    controls.target.lerpVectors(transition.fromTarget, transition.to.target, e);
    camera.fov = THREE.MathUtils.lerp(transition.fromFov, transition.to.fov, e);
    camera.updateProjectionMatrix();
    if (p >= 1) transition = null;
  }

  controls.update();
  if (!document.hidden) renderer.render(scene, camera);
});
setStatus('Ready');
