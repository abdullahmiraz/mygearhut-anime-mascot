import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMascot, ACCENT } from './mascot.js';

const stage = document.getElementById('stage');
const fallback = document.getElementById('fallback');
const statusEl = document.getElementById('status');

const setStatus = (text) => { statusEl.textContent = text; };

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch {
    return false;
  }
}

if (!hasWebGL()) {
  fallback.hidden = false;
  document.querySelectorAll('[data-ui]').forEach((el) => { el.hidden = true; });
} else {
  boot();
}

function boot() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1117);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 1.33, 3.4);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 1.4;
  controls.maxDistance = 9;
  controls.minPolarAngle = 0.45;
  controls.maxPolarAngle = 1.62;

  // Three-point lighting: soft key, cool fill, accent rim. This is what keeps a
  // primitive-built character looking designed instead of like floating shapes.
  scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x333a44, 1.3));

  const faceLight = new THREE.DirectionalLight(0xffe9d4, 1.0);
  faceLight.position.set(0, 1.9, 6);
  scene.add(faceLight);

  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(3.2, 5, 4.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 14;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 3;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9fc4ff, 0.55);
  fill.position.set(-4, 2.2, 2.5);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xcfe6ff, 1.1);
  rim.position.set(-1.5, 3.2, -4);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(5, 64),
    new THREE.MeshStandardMaterial({ color: 0x121a22, roughness: 1, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.012, 8, 90),
    new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.55 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.007;
  scene.add(ring);

  const ringOuter = new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.006, 8, 90),
    new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.2 }),
  );
  ringOuter.rotation.x = Math.PI / 2;
  ringOuter.position.y = 0.006;
  scene.add(ringOuter);

  const mascot = createMascot();
  scene.add(mascot.root);

  // ---- Framing ----
  const FRAMES = {
    full: { distance: 4.3, targetY: 1.12, fov: 34 },
    medium: { distance: 3.4, targetY: 1.38, fov: 32 },
    close: { distance: 2.3, targetY: 1.78, fov: 30 },
  };
  let currentFrame = 'medium';
  let transition = null;

  function frameTarget(name) {
    const f = FRAMES[name] || FRAMES.medium;
    const aspectBoost = Math.max(1, 0.75 / camera.aspect);
    const distance = f.distance * aspectBoost;
    return {
      position: new THREE.Vector3(0, f.targetY + 0.06, distance),
      target: new THREE.Vector3(0, f.targetY, 0),
      fov: f.fov,
    };
  }

  function setFrame(name, instant = false) {
    if (!FRAMES[name]) return;
    currentFrame = name;
    document.querySelectorAll('#framing button').forEach((b) => b.classList.toggle('active', b.dataset.frame === name));
    const to = frameTarget(name);
    if (instant) {
      camera.position.copy(to.position);
      controls.target.copy(to.target);
      camera.fov = to.fov;
      camera.updateProjectionMatrix();
      controls.update();
      transition = null;
    } else {
      transition = {
        t: 0,
        duration: 0.55,
        fromPos: camera.position.clone(),
        fromTarget: controls.target.clone(),
        fromFov: camera.fov,
        to,
      };
      controls.enabled = false;
    }
    setStatus(`Framing: ${name}`);
  }

  // Default framing on first load, otherwise OrbitControls would target the origin.
  setFrame('medium', true);

  // ---- Background ----
  function setBackground(mode) {
    const dark = mode !== 'light';
    const transparent = mode === 'transparent';
    scene.background = transparent ? null : new THREE.Color(dark ? 0x0d1117 : 0xeef2f6);
    floor.visible = !transparent;
    ring.visible = !transparent;
    ringOuter.visible = !transparent;
    floor.material.color.set(dark ? 0x121a22 : 0xd8dee6);
    document.body.classList.toggle('bg-transparent', transparent);
    document.querySelectorAll('#background button').forEach((b) => b.classList.toggle('active', b.dataset.bg === mode));
    setStatus(`Background: ${mode}`);
  }

  // ---- UI ----
  function setTalk(v) {
    mascot.setTalking(v);
    const btn = document.getElementById('talk');
    btn.textContent = `Talk: ${v ? 'on' : 'off'}`;
    btn.setAttribute('aria-pressed', String(v));
    setStatus(v ? 'Talking' : 'Speech idle');
  }

  function setOrbit(v) {
    controls.enabled = v;
    const btn = document.getElementById('orbit');
    btn.textContent = `Orbit: ${v ? 'on' : 'off'}`;
    btn.setAttribute('aria-pressed', String(v));
  }

  function setUI(v) {
    document.body.classList.toggle('hide-ui', !v);
  }

  function reset() {
    mascot.clearGesture();
    setTalk(false);
    setFrame('medium');
    setBackground('dark');
    setOrbit(true);
    setUI(true);
    setStatus('Reset');
  }

  document.querySelectorAll('#gestures button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.gesture;
      mascot.playGesture(name);
      setStatus(`Gesture: ${name}`);
    });
  });
  document.querySelectorAll('#framing button').forEach((btn) => {
    btn.addEventListener('click', () => setFrame(btn.dataset.frame));
  });
  document.querySelectorAll('#background button').forEach((btn) => {
    btn.addEventListener('click', () => setBackground(btn.dataset.bg));
  });
  document.getElementById('talk').addEventListener('click', () => setTalk(!mascot.isTalking));
  document.getElementById('orbit').addEventListener('click', () => setOrbit(!controls.enabled));
  document.getElementById('reset').addEventListener('click', reset);
  document.getElementById('ui-toggle').addEventListener('click', () => setUI(document.body.classList.contains('hide-ui')));

  const gestureKeys = ['wave', 'present', 'point', 'shrug', 'nod', 'think'];
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key >= '1' && e.key <= '6') {
      const name = gestureKeys[Number(e.key) - 1];
      mascot.playGesture(name);
      setStatus(`Gesture: ${name}`);
    } else if (e.key.toLowerCase() === 't') setTalk(!mascot.isTalking);
    else if (e.key.toLowerCase() === 'h') setUI(document.body.classList.contains('hide-ui'));
    else if (e.key.toLowerCase() === 'o') setOrbit(!controls.enabled);
    else if (e.key.toLowerCase() === 'r') reset();
  });

  // ---- Resize and lifecycle ----
  function resize() {
    const { clientWidth: w, clientHeight: h } = stage;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    setStatus('Graphics context lost');
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => setStatus('Graphics restored'));

  // ---- URL options, for scripted capture ----
  const params = new URLSearchParams(location.search);
  if (params.get('ui') === '0') setUI(false);
  if (params.get('frame') && FRAMES[params.get('frame')]) setFrame(params.get('frame'), true);
  if (params.get('bg')) setBackground(params.get('bg'));
  if (params.get('talk') === '1') setTalk(true);
  if (params.get('orbit') === '0') setOrbit(false);
  if (params.get('gesture') && mascot.playGesture(params.get('gesture'))) setStatus(`Gesture: ${params.get('gesture')}`);

  // ---- Public API, used by a recorder or browser automation ----
  window.mascotAPI = {
    ready: true,
    playGesture: (name, duration) => mascot.playGesture(name, duration),
    clearGesture: () => mascot.clearGesture(),
    talk: (v) => setTalk(v),
    amplitude: (v) => mascot.setTalkAmplitude(v),
    frame: (name) => setFrame(name),
    background: (mode) => setBackground(mode),
    orbit: (v) => setOrbit(v),
    ui: (v) => setUI(v),
    blink: () => mascot.blink(),
    reset,
    captureFrame: () => renderer.domElement.toDataURL('image/png'),
  };
  window.dispatchEvent(new CustomEvent('mascot:ready'));

  // ---- Render loop ----
  const clock = new THREE.Clock();
  function animate() {
    const dt = clock.getDelta();
    const t = clock.elapsedTime;
    mascot.update(dt, t);

    if (transition) {
      transition.t += dt;
      const p = Math.min(transition.t / transition.duration, 1);
      const e = p * p * (3 - 2 * p);
      camera.position.lerpVectors(transition.fromPos, transition.to.position, e);
      controls.target.lerpVectors(transition.fromTarget, transition.to.target, e);
      camera.fov = THREE.MathUtils.lerp(transition.fromFov, transition.to.fov, e);
      camera.updateProjectionMatrix();
      if (p >= 1) {
        transition = null;
        controls.enabled = true;
      }
    }

    controls.update();
    ring.material.opacity = 0.45 + Math.sin(t * 1.4) * 0.1;
    if (!document.hidden) renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(animate);
  setStatus('Ready');
}
