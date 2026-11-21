import * as THREE from 'three';

export const ACCENT = 0x22c55e;

const C = {
  skin: 0xf0c2a0,
  skinShade: 0xd9a582,
  hair: 0x33251f,
  hairLight: 0x4a352b,
  eyeWhite: 0xffffff,
  iris: 0x6b4a2f,
  pupil: 0x14100e,
  mouth: 0x7a3b36,
  brow: 0x33251f,
  shirt: ACCENT,
  shirtDark: 0x16833f,
  pants: 0x273040,
  shoe: 0xf2f4f5,
  sole: 0x16833f,
  ink: 0x0b0d10,
};

// Three-step cel ramp from the threejs-materials skill: non-color data,
// nearest filtered so the bands stay hard.
const steps = new Uint8Array([90, 170, 255]);
const gradientMap = new THREE.DataTexture(steps, 3, 1, THREE.RedFormat);
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;
gradientMap.needsUpdate = true;

const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap, ...extra });
const ink = new THREE.MeshBasicMaterial({ color: C.ink, side: THREE.BackSide });

function part(parent, geometry, material, { name, pos, rot, scale, outline = 1.05 } = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  if (name) mesh.name = name;
  if (pos) mesh.position.set(...pos);
  if (rot) mesh.rotation.set(...rot);
  if (scale) mesh.scale.set(...scale);
  mesh.castShadow = true;
  parent.add(mesh);
  if (outline) {
    const line = new THREE.Mesh(geometry, ink);
    line.scale.setScalar(outline);
    mesh.add(line);
  }
  return mesh;
}

function segment(parent, name, radius, length, material, pos) {
  const group = new THREE.Group();
  group.name = name;
  if (pos) group.position.set(...pos);
  parent.add(group);
  part(group, new THREE.CapsuleGeometry(radius, Math.max(0.001, length - 2 * radius), 4, 16), material, {
    pos: [0, -length / 2, 0],
  });
  return group;
}

export function createAnimeMascot() {
  const root = new THREE.Group();
  root.name = 'animeRoot';

  const skin = toon(C.skin);
  const skinShade = toon(C.skinShade);
  const hair = toon(C.hair);
  const hairLight = toon(C.hairLight);
  const eyeWhite = toon(C.eyeWhite);
  const iris = toon(C.iris);
  const pupil = toon(C.pupil);
  const mouthMat = toon(C.mouth);
  const browMat = toon(C.brow);
  const shirt = toon(C.shirt);
  const shirtDark = toon(C.shirtDark);
  const pants = toon(C.pants);
  const shoe = toon(C.shoe);
  const sole = toon(C.sole);

  const joints = {};
  const track = (name, obj, base = { x: 0, y: 0, z: 0 }) => {
    joints[name] = { obj, base, cur: { ...base } };
  };

  const hips = new THREE.Group();
  hips.name = 'hips';
  hips.position.y = 0.72;
  root.add(hips);
  part(hips, new THREE.SphereGeometry(0.19, 20, 14), pants, { pos: [0, -0.02, 0], scale: [1, 0.7, 0.85] });

  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 0.06;
  hips.add(torso);
  track('torso', torso);
  part(torso, new THREE.CapsuleGeometry(0.2, 0.16, 6, 20), shirt, { pos: [0, 0.22, 0] });
  part(torso, new THREE.TorusGeometry(0.1, 0.025, 8, 20), shirtDark, { pos: [0, 0.42, 0], rot: [Math.PI / 2, 0, 0] });
  part(torso, new THREE.SphereGeometry(0.1, 16, 12), shirtDark, { pos: [0, 0.1, 0.16], scale: [1.5, 0.7, 0.35] });

  const neck = segment(torso, 'neck', 0.065, 0.14, skin, [0, 0.42, 0]);
  track('neck', neck);

  const head = new THREE.Group();
  head.name = 'head';
  head.position.y = 0.16;
  neck.add(head);
  track('head', head);
  part(head, new THREE.SphereGeometry(0.3, 32, 24), skin, { scale: [1, 1.02, 0.88] });

  // Anime hair: a cap plus large tapered spikes and side locks.
  part(head, new THREE.SphereGeometry(0.308, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, {
    pos: [0, 0.01, 0], scale: [1.02, 1, 0.94],
  });
  for (let i = 0; i < 7; i++) {
    const x = -0.24 + i * 0.08;
    const y = 0.2 - Math.abs(i - 3) * 0.015;
    part(head, new THREE.ConeGeometry(0.075, 0.22, 7), i % 2 ? hairLight : hair, {
      pos: [x, y, 0.2], rot: [2.6, 0, (i - 3) * 0.12], outline: 1.06,
    });
  }
  for (const s of [-1, 1]) {
    part(head, new THREE.ConeGeometry(0.07, 0.26, 7), hair, {
      pos: [s * 0.28, -0.02, 0.06], rot: [0, 0, s * 0.35], outline: 1.06,
    });
  }

  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(s * 0.115, 0.035, 0.252);
    head.add(eye);
    part(eye, new THREE.SphereGeometry(0.075, 24, 16), eyeWhite, { scale: [0.78, 1.15, 0.28], outline: 0 });
    part(eye, new THREE.SphereGeometry(0.05, 20, 14), iris, { pos: [0, -0.005, 0.018], scale: [0.85, 1, 0.3], outline: 0 });
    part(eye, new THREE.SphereGeometry(0.028, 16, 12), pupil, { pos: [0, -0.005, 0.026], scale: [0.8, 1, 0.3], outline: 0 });
    part(eye, new THREE.SphereGeometry(0.012, 12, 10), eyeWhite, { pos: [-0.018, 0.026, 0.03], outline: 0 });
    part(eye, new THREE.SphereGeometry(0.08, 20, 12), skin, { pos: [0, 0.07, -0.006], scale: [0.8, 0.22, 0.32], outline: 0 });
    eyes.push(eye);

    const brow = part(head, new THREE.BoxGeometry(0.11, 0.017, 0.02), browMat, { pos: [s * 0.115, 0.145, 0.25], rot: [0, 0, s * 0.08] });
    joints[s > 0 ? 'browR' : 'browL'] = { obj: brow, base: { x: 0, y: 0, z: s * 0.08 }, cur: { x: 0, y: 0, z: s * 0.08 } };
  }

  part(head, new THREE.SphereGeometry(0.022, 12, 10), skinShade, { pos: [0, -0.055, 0.268], scale: [1, 0.7, 0.6], outline: 0 });

  const mouth = new THREE.Group();
  mouth.name = 'mouth';
  mouth.position.set(0, -0.13, 0.258);
  head.add(mouth);
  const mouthMesh = part(mouth, new THREE.SphereGeometry(0.05, 18, 12), mouthMat, { scale: [1.2, 0.14, 0.25], outline: 0 });

  // Arms.
  for (const s of [-1, 1]) {
    const label = s > 0 ? 'r' : 'l';
    const shoulder = segment(torso, `${label}Shoulder`, 0.075, 0.3, shirt, [s * 0.25, 0.36, 0]);
    shoulder.rotation.z = s * 0.12;
    track(`${label}Shoulder`, shoulder, { x: 0, y: 0, z: s * 0.12 });
    const elbow = segment(shoulder, `${label}Elbow`, 0.062, 0.28, shirt, [0, -0.3, 0]);
    track(`${label}Elbow`, elbow);
    const hand = new THREE.Group();
    hand.name = `${label}Hand`;
    hand.position.y = -0.28;
    elbow.add(hand);
    track(`${label}Hand`, hand);
    part(hand, new THREE.SphereGeometry(0.07, 16, 12), skin, { scale: [1, 1.1, 0.7] });
  }

  // Legs.
  for (const s of [-1, 1]) {
    const label = s > 0 ? 'r' : 'l';
    const hip = segment(hips, `${label}Hip`, 0.085, 0.36, pants, [s * 0.1, -0.05, 0]);
    track(`${label}Hip`, hip);
    const knee = segment(hip, `${label}Knee`, 0.072, 0.34, pants, [0, -0.36, 0]);
    track(`${label}Knee`, knee);
    part(knee, new THREE.SphereGeometry(0.075, 16, 12), shoe, { pos: [0, -0.35, 0.045], scale: [1, 0.65, 1.5], outline: 1.05 });
    part(knee, new THREE.BoxGeometry(0.14, 0.025, 0.22), sole, { pos: [0, -0.39, 0.05], outline: 0 });
  }

  const POSES = {
    idle: { head: [0, 0, 0], rShoulder: [0, 0, 0.12], lShoulder: [0, 0, -0.12], rElbow: [0.08, 0, 0], lElbow: [0.08, 0, 0], mouth: 0.14, browL: 0, browR: 0 },
    thinking: { head: [-0.08, 0.16, 0.1], rShoulder: [-0.95, 0, 0.45], lShoulder: [0, 0, -0.12], rElbow: [-1.9, 0, 0], lElbow: [0.08, 0, 0], mouth: 0.08, browL: 0.05, browR: 0.16 },
    speaking: { head: [0.02, 0.06, 0], rShoulder: [-0.2, 0, 0.35], lShoulder: [-0.2, 0, -0.35], rElbow: [-0.5, 0, 0], lElbow: [-0.5, 0, 0], mouth: 0.45, browL: 0, browR: 0 },
    waving: { head: [0, 0, -0.05], rShoulder: [-0.1, 0, 2.5], lShoulder: [0, 0, -0.12], rElbow: [-0.5, 0, 0], lElbow: [0.08, 0, 0], mouth: 0.18, browL: 0, browR: 0 },
    error: { head: [0.1, 0, -0.08], rShoulder: [-0.3, 0, 0.4], lShoulder: [-0.3, 0, -0.4], rElbow: [-0.8, 0, 0], lElbow: [-0.8, 0, 0], mouth: 0.08, browL: -0.12, browR: -0.12 },
  };

  let state = 'idle';
  let blinkAt = 2.4;
  let blinkStart = -1;
  let lastT = 0;
  const BLINK = 0.13;

  function setState(name) {
    if (!POSES[name]) return false;
    state = name;
    return true;
  }

  function update(dt, t) {
    dt = Math.min(dt, 0.05);
    lastT = t;
    const pose = POSES[state];
    const k = 1 - Math.exp(-dt * 9);

    for (const [name, j] of Object.entries(joints)) {
      const values = pose[name];
      if (!values) continue;
      j.cur.x += (j.base.x + values[0] - j.cur.x) * k;
      j.cur.y += (j.base.y + values[1] - j.cur.y) * k;
      j.cur.z += (j.base.z + values[2] - j.cur.z) * k;
      j.obj.rotation.set(j.cur.x, j.cur.y, j.cur.z);
    }

    // Idle life on top of the state pose.
    const breathe = Math.sin(t * 1.8) * 0.006;
    root.position.y = breathe;
    head.rotation.y += Math.sin(t * 0.6) * 0.025;
    if (state === 'waving') joints.rHand.rotation.z = Math.sin(t * 12) * 0.35;
    if (state === 'speaking') head.rotation.x += Math.sin(t * 5) * 0.02;
    if (state === 'error') root.position.x = Math.sin(t * 28) * 0.006;
    else root.position.x = 0;

    let open = pose.mouth;
    if (state === 'speaking') open = 0.2 + Math.abs(Math.sin(t * 12.5)) * 0.5;
    mouthMesh.scale.y += (open - mouthMesh.scale.y) * (1 - Math.exp(-dt * 16));

    if (blinkStart < 0 && t > blinkAt) blinkStart = t;
    let eyeScale = 1;
    if (blinkStart >= 0) {
      const bp = (t - blinkStart) / BLINK;
      if (bp >= 1) { blinkStart = -1; blinkAt = t + 2 + Math.random() * 3; }
      else eyeScale = 1 - 0.92 * Math.sin(bp * Math.PI);
    }
    for (const eye of eyes) eye.scale.y = eyeScale;
  }

  return {
    root,
    parts: { head, mouth, eyes },
    update,
    setState,
    get state() { return state; },
    blink: () => { if (blinkStart < 0) blinkStart = lastT - BLINK * 0.5; },
  };
}
