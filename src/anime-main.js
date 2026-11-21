import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createAnimeMascot } from './anime-mascot.js';

const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
const setStatus = (text) => { statusEl.textContent = text; };
const params = new URLSearchParams(location.search);
const manualClock = params.get('manual') === '1';
const pointerButton = document.getElementById('pointer-toggle');
const talkButton = document.getElementById('talk-toggle');
const overlayButton = document.getElementById('overlay');

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
  full: { distance: 3.85, targetY: 0.975, fov: 34, minAspect: 0.62, elevation: 0.3 },
  medium: { distance: 2.62, targetY: 1.34, fov: 32, minAspect: 0.66, elevation: 0.06 },
  close: { distance: 1.72, targetY: 1.64, fov: 30, minAspect: 0.67, elevation: 0.015 },
  overlay: { distance: 4.44, targetY: 1.02, fov: 36, minAspect: 0.98, elevation: 0.09 },
};
let transition = null;
let currentFrame = 'medium';
let currentBackground = 'dark';
let zoomCue = null;
let heldZoom = 1;
const ZOOM_MOVES = {
  in: { duration: 0.92, label: 'Push in', scale: 1.20 },
  out: { duration: 0.92, label: 'Pull out', scale: 1 / 1.20 },
  punch: { duration: 0.84, label: 'Punch in' },
};
const ease = (progress) => progress * progress * (3 - 2 * progress);

function cueZoom(target, duration, punch = false) {
  zoomCue = { elapsed: 0, from: camera.zoom, to: target, duration, punch };
}

function zoom(name, seconds) {
  if (!Object.hasOwn(ZOOM_MOVES, name)) return false;
  const { duration, label, scale } = ZOOM_MOVES[name];
  const secondsToPlay = Number.isFinite(seconds) ? THREE.MathUtils.clamp(seconds, 0.12, 6) : duration;
  if (name === 'punch') {
    cueZoom(heldZoom * 1.13, secondsToPlay, true);
  } else {
    heldZoom = THREE.MathUtils.clamp(heldZoom * scale, 0.70, 1.65);
    cueZoom(heldZoom, secondsToPlay);
  }
  setStatus(label);
  return true;
}

function updateZoom(dt) {
  if (!zoomCue) return;
  zoomCue.elapsed += dt;
  const { elapsed, from, to, duration, punch } = zoomCue;
  const progress = Math.min(1, elapsed / duration);
  if (!punch) {
    camera.zoom = THREE.MathUtils.lerp(from, to, ease(progress));
  } else if (progress < 0.32) {
    camera.zoom = THREE.MathUtils.lerp(from, to, ease(progress / 0.32));
  } else if (progress < 0.53) {
    camera.zoom = to;
  } else {
    camera.zoom = THREE.MathUtils.lerp(to, heldZoom, ease((progress - 0.53) / 0.47));
  }
  camera.updateProjectionMatrix();
  if (progress >= 1) zoomCue = null;
}

const syncOverlayButton = () => {
  overlayButton.setAttribute('aria-pressed', String(currentFrame === 'overlay' && currentBackground === 'transparent'));
};

const frameBoost = (name, aspect) => Math.max(1, FRAMES[name].minAspect / aspect);

function setFrame(name, instant = false) {
  if (!Object.hasOwn(FRAMES, name)) return false;
  currentFrame = name;
  heldZoom = 1;
  const f = FRAMES[name];
  document.querySelectorAll('#framing button').forEach((b) => b.classList.toggle('active', b.dataset.frame === name));
  const boost = frameBoost(name, camera.aspect);
  const yaw = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
  const distance = f.distance * boost;
  const to = {
    position: new THREE.Vector3(Math.sin(yaw) * distance, f.targetY + f.elevation * boost, Math.cos(yaw) * distance),
    target: new THREE.Vector3(0, f.targetY, 0),
    fov: f.fov,
  };
  if (instant) {
    camera.position.copy(to.position);
    controls.target.copy(to.target);
    camera.fov = to.fov;
    camera.zoom = heldZoom;
    zoomCue = null;
    camera.updateProjectionMatrix();
    transition = null;
  } else {
    transition = {
      t: 0, duration: 0.5, to,
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      fromFov: camera.fov,
    };
    cueZoom(heldZoom, transition.duration);
  }
  syncOverlayButton();
  setStatus(`Framing: ${name}`);
  return true;
}

function setBackground(mode) {
  if (!Object.hasOwn(backdrops, mode)) return false;
  currentBackground = mode;
  const transparent = mode === 'transparent';
  scene.background = backdrops[mode];
  contact.visible = !transparent;
  contact.material.uniforms.opacity.value = mode === 'light' ? 0.32 : 0.63;
  document.body.classList.toggle('bg-transparent', transparent);
  document.body.classList.toggle('bg-light', mode === 'light');
  document.querySelectorAll('#background button').forEach((b) => b.classList.toggle('active', b.dataset.bg === mode));
  syncOverlayButton();
  setStatus(`Background: ${mode}`);
  return true;
}

function fitOverlay(instant = false) {
  setBackground('transparent');
  setFrame('overlay', instant);
  setStatus('Transparent overlay');
}

function syncTalkButton() {
  talkButton.setAttribute('aria-pressed', String(mascot.isTalking));
}

function setTalking(enabled) {
  mascot.setTalking(enabled);
  syncTalkButton();
  setStatus(mascot.isTalking ? 'Talk on' : 'Talk off');
}

function setPointer(enabled) {
  mascot.setPointer(enabled);
  pointerButton.setAttribute('aria-pressed', String(mascot.hasPointer));
  setStatus(mascot.hasPointer ? 'Teaching pointer on' : 'Teaching pointer off');
}

function setState(name) {
  if (!mascot.setState(name)) return false;
  document.querySelectorAll('#states button').forEach((b) => b.classList.toggle('active', b.dataset.state === name));
  syncTalkButton();
  setStatus(`State: ${name}`);
  return true;
}

document.querySelectorAll('#states button').forEach((b) => b.addEventListener('click', () => setState(b.dataset.state)));
document.querySelectorAll('#framing button').forEach((b) => b.addEventListener('click', () => setFrame(b.dataset.frame)));
document.querySelectorAll('#background button').forEach((b) => b.addEventListener('click', () => setBackground(b.dataset.bg)));
document.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => zoom(b.dataset.zoom)));
talkButton.addEventListener('click', () => setTalking(!mascot.isTalking));
pointerButton.addEventListener('click', () => setPointer(!mascot.hasPointer));
overlayButton.addEventListener('click', () => fitOverlay());
document.getElementById('save-png').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `mygearhut-${mascot.state}-${currentBackground}.png`;
  link.href = captureFrame();
  link.click();
});
document.getElementById('ui-toggle').addEventListener('click', () => setUI(document.body.classList.contains('hide-ui')));

function setUI(v) { document.body.classList.toggle('hide-ui', !v); }

const keys = ['idle', 'thinking', 'speaking', 'waving', 'error'];
window.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
  const key = e.key.toLowerCase();
  if (key >= '1' && key <= '5') setState(keys[Number(key) - 1]);
  else if (key === 'h') setUI(document.body.classList.contains('hide-ui'));
  else if (key === 'p') setPointer(!mascot.hasPointer);
  else if (key === 't') setTalking(!mascot.isTalking);
});

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  const scale = frameBoost(currentFrame, aspect) / frameBoost(currentFrame, camera.aspect);
  if (scale !== 1) {
    camera.position.sub(controls.target).multiplyScalar(scale).add(controls.target);
    if (transition) {
      transition.fromPos.sub(transition.fromTarget).multiplyScalar(scale).add(transition.fromTarget);
      transition.to.position.sub(transition.to.target).multiplyScalar(scale).add(transition.to.target);
    }
  }
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

setFrame('medium', true);
if (params.get('ui') === '0') setUI(false);
if (params.get('overlay') === '1') fitOverlay(true);
if (params.get('frame')) setFrame(params.get('frame'), true);
if (params.get('bg')) setBackground(params.get('bg'));
if (params.get('state')) setState(params.get('state'));
if (params.get('pointer') === '1') setPointer(true);
if (params.get('talk') === '1') setTalking(true);
if (params.get('zoom')) zoom(params.get('zoom'));
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

function captureFrame() {
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
}

function draw(dt, t, render = true) {
  mascot.update(dt, t);

  if (transition) {
    transition.t += dt;
    const p = Math.min(transition.t / transition.duration, 1);
    const e = ease(p);
    camera.position.lerpVectors(transition.fromPos, transition.to.position, e);
    controls.target.lerpVectors(transition.fromTarget, transition.to.target, e);
    camera.fov = THREE.MathUtils.lerp(transition.fromFov, transition.to.fov, e);
    camera.updateProjectionMatrix();
    if (p >= 1) transition = null;
  }

  updateZoom(dt);
  controls.update();
  if (render && (manualClock || !document.hidden)) renderer.render(scene, camera);
}

let manualTime = 0;
function step(seconds = 1 / 30) {
  if (!manualClock || !Number.isFinite(seconds) || seconds <= 0 || seconds > 1) return false;
  // Match the rig's maximum timestep so low-rate exports do not slow poses down.
  const steps = Math.ceil(seconds / 0.05);
  const dt = seconds / steps;
  for (let i = 0; i < steps; i++) {
    manualTime += dt;
    draw(dt, manualTime, i === steps - 1);
  }
  return true;
}

window.animeMascot = {
  ready: true,
  state: setState,
  frame: setFrame,
  background: setBackground,
  overlay: fitOverlay,
  zoom,
  pointer: setPointer,
  talk: setTalking,
  ui: setUI,
  blink: () => mascot.blink(),
  captureFrame,
  step,
};
draw(0, 0);
if (!manualClock) {
  const timer = new THREE.Timer();
  timer.connect(document);
  renderer.setAnimationLoop(() => {
    timer.update();
    draw(timer.getDelta(), timer.getElapsed());
  });
}
window.dispatchEvent(new CustomEvent('mascot:ready'));
