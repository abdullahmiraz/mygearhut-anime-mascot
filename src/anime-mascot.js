import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

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

function segment(parent, name, radius, length, material, pos, outline = 1.05) {
  const group = new THREE.Group();
  group.name = name;
  if (pos) group.position.set(...pos);
  parent.add(group);
  part(group, new THREE.CapsuleGeometry(radius, Math.max(0.001, length - 2 * radius), 4, 16), material, {
    pos: [0, -length / 2, 0], outline,
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
  hips.position.y = 0.79;
  root.add(hips);
  part(hips, new THREE.SphereGeometry(0.19, 20, 14), pants, { pos: [0, -0.05, 0], scale: [0.95, 1.06, 0.88] });
  part(hips, new THREE.SphereGeometry(0.06, 14, 10), pants, { pos: [0, -0.14, 0], outline: 0 });

  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 0.06;
  hips.add(torso);
  track('torso', torso);
  part(torso, new THREE.CapsuleGeometry(0.2, 0.16, 6, 20), shirt, { pos: [0, 0.2, 0], scale: [1.18, 1, 1.02] });
  part(torso, new THREE.TorusGeometry(0.1, 0.025, 8, 20), shirtDark, { pos: [0, 0.42, 0], rot: [Math.PI / 2, 0, 0] });

  // Neck rises out of the collar; the head sits above it with a small overlap.
  const neck = new THREE.Group();
  neck.name = 'neck';
  neck.position.y = 0.42;
  torso.add(neck);
  track('neck', neck);
  part(neck, new THREE.CylinderGeometry(0.082, 0.1, 0.2, 20), skin, { pos: [0, 0.1, 0] });

  const head = new THREE.Group();
  head.name = 'head';
  head.position.y = 0.35;
  neck.add(head);
  track('head', head);
  // Sculpted head: taper the jaw and push a small chin so the face reads human
  // instead of a round ball with features stuck on it.
  const headGeo = new THREE.SphereGeometry(0.3, 40, 28);
  const hp = headGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    let x = hp.getX(i);
    let y = hp.getY(i);
    let z = hp.getZ(i);
    const front = Math.max(0, z / 0.3);
    const jaw = THREE.MathUtils.smoothstep(-0.02 - y, 0, 0.28);
    x *= 1 - jaw * 0.2;
    y *= 1.02;
    z *= 0.86;
    z += Math.exp(-Math.pow((y + 0.18) / 0.06, 2)) * front * 0.018;
    hp.setXYZ(i, x, y, z);
  }
  hp.needsUpdate = true;
  headGeo.computeVertexNormals();
  part(head, headGeo, skin, {});

  // Hair follows the reference: short textured top, faded sides, and a rear
  // mass that runs down to the nape so it lines up with the neck.
  part(head, new THREE.SphereGeometry(0.307, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.32), hair, {
    pos: [0, 0.02, 0], scale: [1.02, 1, 0.94], outline: 1.03,
  });
  part(head, new THREE.SphereGeometry(0.3, 28, 20), hair, {
    pos: [0, -0.02, -0.1], scale: [0.94, 0.92, 0.62], outline: 1.03,
  });
  part(head, new THREE.SphereGeometry(0.085, 16, 12), hair, {
    pos: [0, -0.19, -0.16], scale: [1.1, 1.4, 0.55], outline: 1.03,
  });
  for (const s of [-1, 1]) {
    part(head, new THREE.SphereGeometry(0.1, 16, 12), hair, {
      pos: [s * 0.26, 0.03, -0.11], scale: [0.35, 1.1, 0.7], outline: 1.03,
    });
  }
  // Three soft fringe clumps instead of a flat band or stray spikes.
  for (const [x, y, z] of [[-0.12, 0.23, 0.19], [0, 0.2, 0.2], [0.12, 0.23, 0.19]]) {
    part(head, new THREE.SphereGeometry(0.08, 18, 12), hair, {
      pos: [x, y, z], scale: [1.2, 0.45, 0.5], outline: 1.03,
    });
  }
  for (let i = 0; i < 11; i++) {
    const x = -0.22 + i * 0.044;
    const y = 0.24 - Math.abs(i - 5) * 0.006;
    part(head, new THREE.ConeGeometry(0.035, 0.09, 6), i % 2 ? hairLight : hair, {
      pos: [x, y, 0.17], rot: [2.2, 0, (i - 5) * 0.1], outline: 1.04,
    });
  }
  for (const s of [-1, 1]) {
    // Ears only. The old hanging hair locks below them read as black shapes.
    part(head, new THREE.SphereGeometry(0.06, 18, 14), skin, {
      pos: [s * 0.27, -0.03, 0.045], rot: [0, s * 0.3, 0], scale: [0.45, 1, 0.75], outline: 0,
    });
    part(head, new THREE.SphereGeometry(0.025, 14, 10), skinShade, {
      pos: [s * 0.29, -0.03, 0.07], scale: [0.3, 0.6, 0.3], outline: 0,
    });
  }

  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(s * 0.092, 0.055, 0.235);
    head.add(eye);
    part(eye, new THREE.SphereGeometry(0.07, 24, 16), eyeWhite, { scale: [0.85, 1, 0.2], outline: 0 });
    part(eye, new THREE.SphereGeometry(0.045, 20, 14), iris, { pos: [0, 0.002, 0.016], scale: [0.92, 1, 0.3], outline: 0 });
    part(eye, new THREE.SphereGeometry(0.025, 16, 12), pupil, { pos: [0, 0.002, 0.023], scale: [0.85, 1, 0.3], outline: 0 });
    part(eye, new THREE.SphereGeometry(0.012, 12, 10), eyeWhite, { pos: [-0.016, 0.022, 0.028], outline: 0 });
    eyes.push(eye);

    const brow = part(head, new THREE.BoxGeometry(0.1, 0.012, 0.018), browMat, { pos: [s * 0.105, 0.15, 0.258], rot: [0, 0, s * 0.1] });
    joints[s > 0 ? 'browR' : 'browL'] = { obj: brow, base: { x: 0, y: 0, z: s * 0.1 }, cur: { x: 0, y: 0, z: s * 0.1 } };
  }

  part(head, new THREE.CapsuleGeometry(0.009, 0.022, 3, 10), skinShade, {
    pos: [0, -0.006, 0.26], rot: [-0.12, 0, 0], outline: 0,
  });
  part(head, new THREE.SphereGeometry(0.016, 14, 10), skinShade, {
    pos: [0, -0.03, 0.268], scale: [1.2, 0.8, 1], outline: 0,
  });

  const mouth = new THREE.Group();
  mouth.name = 'mouth';
  mouth.position.set(0, -0.115, 0.258);
  head.add(mouth);
  const smileMat = toon(C.mouth, { transparent: true, opacity: 1 });
  const openMat = toon(C.mouth, { transparent: true, opacity: 0 });
  const smile = part(mouth, new THREE.TorusGeometry(0.038, 0.0045, 6, 22, Math.PI * 0.8), smileMat, {
    rot: [0, 0, Math.PI * 1.1], outline: 0,
  });
  const mouthMesh = part(mouth, new THREE.SphereGeometry(0.038, 18, 12), openMat, {
    scale: [1.1, 0.01, 0.25], outline: 0,
  });

  // Arms.
  for (const s of [-1, 1]) {
    const label = s > 0 ? 'r' : 'l';
    part(torso, new THREE.SphereGeometry(0.105, 16, 12), shirt, { pos: [s * 0.25, 0.36, 0], outline: 0 });
    const shoulder = segment(torso, `${label}Shoulder`, 0.075, 0.3, shirt, [s * 0.25, 0.36, 0], 0);
    shoulder.rotation.z = s * 0.12;
    track(`${label}Shoulder`, shoulder, { x: 0, y: 0, z: s * 0.12 });
    const elbow = segment(shoulder, `${label}Elbow`, 0.062, 0.28, shirt, [0, -0.3, 0], 0);
    part(elbow, new THREE.SphereGeometry(0.066, 16, 12), shirt, { outline: 0 });
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
    const hip = segment(hips, `${label}Hip`, 0.085, 0.36, pants, [s * 0.1, -0.083, 0]);
    part(hip, new THREE.SphereGeometry(0.088, 16, 12), pants, {});
    track(`${label}Hip`, hip);
    const knee = segment(hip, `${label}Knee`, 0.072, 0.3, pants, [0, -0.36, 0], 0);
    part(knee, new THREE.SphereGeometry(0.086, 16, 12), pants, { outline: 0 });
    track(`${label}Knee`, knee);
    // Layered sneaker: outsole, midsole, toe cap, upper, tongue and laces.
    const foot = new THREE.Group();
    foot.name = `${label}Foot`;
    foot.position.y = -0.29;
    knee.add(foot);
    part(foot, new RoundedBoxGeometry(0.18, 0.028, 0.3, 3, 0.012), sole, { pos: [0, -0.042, 0.07], outline: 0 });
    part(foot, new RoundedBoxGeometry(0.185, 0.03, 0.305, 3, 0.012), shoe, { pos: [0, -0.02, 0.07], outline: 1.03 });
    part(foot, new THREE.SphereGeometry(0.062, 16, 12), shoe, { pos: [0, 0.005, 0.08], scale: [1, 0.7, 1.4], outline: 1.04 });
    part(foot, new THREE.SphereGeometry(0.052, 14, 10), shoe, { pos: [0, 0.0, 0.135], scale: [1.1, 0.55, 0.65], outline: 0 });
    part(foot, new RoundedBoxGeometry(0.05, 0.012, 0.07, 2, 0.005), shoe, { pos: [0, 0.045, 0.025], rot: [-0.3, 0, 0], outline: 0 });
    for (let i = 0; i < 3; i++) {
      part(foot, new THREE.CapsuleGeometry(0.0035, 0.038, 3, 8), shoe, {
        pos: [0, 0.038 + i * 0.003, 0.055 - i * 0.022], rot: [0, 0, i % 2 ? -0.5 : 0.5], outline: 0,
      });
    }
    part(foot, new RoundedBoxGeometry(0.012, 0.026, 0.16, 2, 0.005), sole, {
      pos: [s * 0.094, 0.0, 0.075], outline: 0,
    });
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
      if (values == null) continue;
      const v = Array.isArray(values) ? values : [0, 0, values];
      j.cur.x += (j.base.x + v[0] - j.cur.x) * k;
      j.cur.y += (j.base.y + v[1] - j.cur.y) * k;
      j.cur.z += (j.base.z + v[2] - j.cur.z) * k;
      j.obj.rotation.set(j.cur.x, j.cur.y, j.cur.z);
    }

    // Idle life on top of the state pose.
    const breathe = Math.sin(t * 1.8) * 0.006;
    root.position.y = breathe;
    head.rotation.y += Math.sin(t * 0.6) * 0.025;
    if (state === 'waving') joints.rHand.obj.rotation.z = Math.sin(t * 12) * 0.35;
    else joints.rHand.obj.rotation.z = 0;
    if (state === 'speaking') head.rotation.x += Math.sin(t * 5) * 0.02;
    if (state === 'error') root.position.x = Math.sin(t * 28) * 0.006;
    else root.position.x = 0;

    let open = pose.mouth;
    if (state === 'speaking') open = 0.2 + Math.abs(Math.sin(t * 12.5)) * 0.5;
    const mouthK = 1 - Math.exp(-dt * 16);
    mouthMesh.scale.y += (Math.max(0.01, open) - mouthMesh.scale.y) * mouthK;
    openMat.opacity += ((state === 'speaking' ? 1 : 0) - openMat.opacity) * mouthK;
    smileMat.opacity += ((state === 'speaking' ? 0 : 1) - smileMat.opacity) * mouthK;

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
