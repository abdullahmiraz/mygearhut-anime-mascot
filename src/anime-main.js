import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createAnimeMascot } from './anime-mascot.js';

const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
const setStatus = (text) => { statusEl.textContent = text; };

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();

function studioBackdrop(center, middle, edge) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(256, 207, 22, 256, 247, 337);
  gradient.addColorStop(0, center);
  gradient.addColorStop(0.55, middle);
  gradient.addColorStop(1, edge);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const backdrops = {
  dark: studioBackdrop('#283d49', '#182630', '#101820'),
  light: studioBackdrop('#f7faf5', '#e1eae5', '#c8d8d4'),
  transparent: null,
};
scene.background = backdrops.dark;

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;

// A broad ambient base keeps the cel steps readable in profile and from behind.
scene.add(new THREE.HemisphereLight(0xffeedf, 0x8394b0, 2.1));
const key = new THREE.DirectionalLight(0xffefe1, 1.65);
key.position.set(2, 4, 5);
scene.add(key);
const rim = new THREE.DirectionalLight(0xaac9ff, 0.8);
rim.position.set(-3, 2, -4);
scene.add(rim);

const contact = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: { opacity: { value: 0.63 } },
  vertexShader: `
    varying vec2 coords;
    void main() {
      coords = uv * 2.0 - 1.0;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    varying vec2 coords;
    uniform float opacity;
    void main() {
      float falloff = 1.0 - smoothstep(0.0, 1.0, length(coords));
      gl_FragColor = vec4(0.04, 0.06, 0.08, opacity * falloff * falloff);
    }`,
}));
contact.rotation.x = -Math.PI / 2;
contact.position.set(0, 0, 0.052);
scene.add(contact);

const mascot = createAnimeMascot();
scene.add(mascot.root);

const FRAMES = {
  full: { distance: 3.85, targetY: 0.975, fov: 34, minAspect: 0.52, elevation: 0.3 },
  medium: { distance: 2.62, targetY: 1.34, fov: 32, minAspect: 0.66, elevation: 0.06 },
  close: { distance: 1.72, targetY: 1.64, fov: 30, minAspect: 0.67, elevation: 0.015 },
};
let transition = null;

function setFrame(name, instant = false) {
  const f = FRAMES[name];
  if (!Object.hasOwn(FRAMES, name)) return;
  document.querySelectorAll('#framing button').forEach((b) => b.classList.toggle('active', b.dataset.frame === name));
  const boost = Math.max(1, f.minAspect / camera.aspect);
  const to = {
    position: new THREE.Vector3(0, f.targetY + f.elevation * boost, f.distance * boost),
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
  if (!Object.hasOwn(backdrops, mode)) return;
  const transparent = mode === 'transparent';
  scene.background = backdrops[mode];
  contact.visible = !transparent;
  contact.material.uniforms.opacity.value = mode === 'light' ? 0.32 : 0.63;
  document.body.classList.toggle('bg-transparent', transparent);
  document.body.classList.toggle('bg-light', mode === 'light');
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
const angle = Number(params.get('yaw'));
if (Number.isFinite(angle) && angle !== 0) {
  const yaw = THREE.MathUtils.degToRad(angle);
  const dx = camera.position.x - controls.target.x;
  const dz = camera.position.z - controls.target.z;
  const d = Math.hypot(dx, dz);
  camera.position.x = controls.target.x + Math.sin(yaw) * d;
  camera.position.z = controls.target.z + Math.cos(yaw) * d;
  controls.update();
}

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
