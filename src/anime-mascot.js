import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const ACCENT = 0x22c55e;

const COLORS = {
  skin: 0xe9ad80,
  ear: 0xc68460,
  hair: 0x392722,
  fade: 0x745440,
  brow: 0x36231e,
  eyeWhite: 0xfff7e9,
  iris: 0x8b5130,
  irisEdge: 0x472c22,
  pupil: 0x1e1517,
  mouth: 0x793f36,
  trim: 0x157e46,
  pants: 0x303e5a,
  shoe: 0xf1eee5,
  rubber: 0xc7d0c4,
  outsole: 0x17694b,
  ink: 0x1b171f,
};

const ramp = new THREE.DataTexture(new Uint8Array([100, 146, 200, 255]), 4, 1, THREE.RedFormat);
ramp.minFilter = THREE.NearestFilter;
ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;

const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra });
const flat = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
const outline = flat(COLORS.ink, { side: THREE.BackSide });

function part(parent, geometry, material, { pos, rot, scale, ink = 0 } = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  if (pos) mesh.position.set(...pos);
  if (rot) mesh.rotation.set(...rot);
  if (scale) mesh.scale.set(...scale);
  parent.add(mesh);
  if (ink) {
    const edge = new THREE.Mesh(geometry, outline);
    edge.scale.setScalar(1 + ink);
    mesh.add(edge);
  }
  return mesh;
}

function oval(parent, x, y, z, material, options = {}) {
  return part(parent, new THREE.SphereGeometry(1, 24, 16), material, { ...options, scale: [x, y, z] });
}

function profileGeometry(profile, depth) {
  const curve = new THREE.SplineCurve(profile.map(([y, radius]) => new THREE.Vector2(radius, y)));
  const points = curve.getPoints(44);
  for (const point of points) point.x = Math.max(0.0001, point.x);
  return new THREE.LatheGeometry(points, 32).scale(1, 1, depth);
}

// Each sleeve and trouser leg is one surface. Vertices around the bend share
// both bones so the fabric closes over the elbow or knee throughout a gesture.
function limb(parent, material, pos, length, blendWidth, depth, profile) {
  const geometry = profileGeometry(profile, depth);
  const positions = geometry.attributes.position;
  const indices = new Uint16Array(positions.count * 4);
  const weights = new Float32Array(positions.count * 4);
  for (let i = 0; i < positions.count; i++) {
    const lowerWeight = THREE.MathUtils.smoothstep(-positions.getY(i), length - blendWidth, length + blendWidth);
    indices[i * 4 + 1] = 1;
    weights[i * 4] = 1 - lowerWeight;
    weights[i * 4 + 1] = lowerWeight;
  }
  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(weights, 4));

  const upper = new THREE.Bone();
  const lower = new THREE.Bone();
  lower.position.y = -length;
  upper.add(lower);

  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.position.set(...pos);
  // The rest-pose bounds do not include the raised arm.
  mesh.frustumCulled = false;
  mesh.add(upper);
  mesh.bind(new THREE.Skeleton([upper, lower]));
  parent.add(mesh);
  return { upper, lower };
}

const HEAD = { width: 0.291, height: 0.29, depth: 0.252 };
const jawWidth = y => 1 - 0.16 * THREE.MathUtils.smoothstep(-y, 0.02, HEAD.height);

function faceRelief(x, y) {
  const bridge = Math.exp(-((x / 0.028) ** 2) - (((y + 0.005) / 0.052) ** 2));
  const tip = Math.exp(-((x / 0.036) ** 2) - (((y + 0.043) / 0.023) ** 2));
  const chin = Math.exp(-((x / 0.09) ** 2) - (((y + 0.195) / 0.058) ** 2));
  return 0.016 * bridge + 0.025 * tip + 0.009 * chin;
}

function faceDepth(x, y) {
  const normalizedX = x / (HEAD.width * jawWidth(y));
  const normalizedY = y / HEAD.height;
  const z = Math.sqrt(Math.max(0, 1 - normalizedX ** 2 - normalizedY ** 2));
  return HEAD.depth * z + z * faceRelief(x, y);
}

function headGeometry() {
  const geometry = new THREE.SphereGeometry(1, 64, 48);
  const points = geometry.attributes.position;
  for (let i = 0; i < points.count; i++) {
    const y = HEAD.height * points.getY(i);
    const x = HEAD.width * jawWidth(y) * points.getX(i);
    const z = points.getZ(i);
    points.setXYZ(i, x, y, z * HEAD.depth + Math.max(0, z) * faceRelief(x, y));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function hairGeometry() {
  const geometry = new THREE.SphereGeometry(1, 96, 42, 0, Math.PI * 2, 0, Math.PI / 2);
  const points = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const colors = new Float32Array(points.count * 3);
  const baseColor = new THREE.Color(COLORS.hair);
  const fadeColor = new THREE.Color(COLORS.fade);
  const sheen = new THREE.Color(0x79523e);
  const color = new THREE.Color();

  for (let i = 0; i < points.count; i++) {
    const angle = (uv.getX(i) - 0.25) * Math.PI * 2;
    const t = 1 - uv.getY(i);
    const front = Math.cos(angle);
    const frontWeight = THREE.MathUtils.smoothstep(front, 0.15, 1);
    const sweep = Math.sin(angle);
    const fringe = Math.exp(-(((sweep + 0.36) / 0.43) ** 2));
    const part = Math.exp(-(((sweep - 0.46) / 0.26) ** 2));
    const nape = THREE.MathUtils.smoothstep(-front, 0.35, 1);
    const edge = 1.69 - front * 0.65 + frontWeight * (0.028 * fringe - 0.15 * part) + 0.17 * nape;
    const phi = t * edge;
    const edgeBlend = THREE.MathUtils.smoothstep(t, 0.94, 1);
    const crown = 1 - THREE.MathUtils.smoothstep(phi, 0.8, 1.68);
    const strand = 0.5 + 0.5 * Math.cos(angle * 5 + phi * 5.2 + 0.86 * Math.sin(angle));
    const lock = strand ** 3 * Math.sin(phi) * (0.55 + 0.45 * frontWeight);
    const lift = 0.008 + crown * (0.018 - 0.015 * sweep + 0.044 * lock);
    const shell = THREE.MathUtils.lerp(lift, -0.003, edgeBlend);
    const y = Math.cos(phi) * (HEAD.height + shell);
    const x = Math.sin(angle) * Math.sin(phi) * (HEAD.width * jawWidth(y) + shell);
    const z = Math.cos(angle) * Math.sin(phi) * (HEAD.depth + shell);
    points.setXYZ(i, x, y, z);

    const fadedEdge = (1 - frontWeight) * THREE.MathUtils.smoothstep(phi, 1.04, edge);
    color.copy(baseColor).lerp(sheen, 0.69 * lock * crown).lerp(fadeColor, 0.9 * fadedEdge);
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  // The longitude seam shares a position but has separate UV vertices.
  const normals = geometry.attributes.normal;
  const normal = new THREE.Vector3();
  for (let row = 0; row <= 42; row++) {
    const first = row * 97;
    const last = first + 96;
    normal.set(normals.getX(first) + normals.getX(last), normals.getY(first) + normals.getY(last), normals.getZ(first) + normals.getZ(last)).normalize();
    normals.setXYZ(first, normal.x, normal.y, normal.z);
    normals.setXYZ(last, normal.x, normal.y, normal.z);
  }
  return geometry;
}

// Facial details are projected back onto the sculpt so they follow its
// curvature in three-quarter and profile shots.
function facePatch(parent, shape, material, x, y, offset) {
  const geometry = new THREE.ShapeGeometry(shape, 20);
  const points = geometry.attributes.position;
  for (let i = 0; i < points.count; i++) {
    const dx = points.getX(i);
    const dy = points.getY(i);
    points.setZ(i, faceDepth(x + dx, y + dy) - parent.position.z + offset);
  }
  geometry.computeVertexNormals();
  return part(parent, geometry, material, { pos: [x - parent.position.x, y - parent.position.y, 0] });
}

function ellipse(x, y, width, height) {
  return new THREE.Shape().absellipse(x, y, width, height, 0, Math.PI * 2, false);
}

function makeEye(head, side) {
  const eye = new THREE.Group();
  const x = side * 0.108;
  const y = 0.047;
  eye.position.set(x, y, faceDepth(x, y));
  head.add(eye);

  const lens = (w, h) => new THREE.Shape()
    .moveTo(-w, -0.004)
    .bezierCurveTo(-w * 0.68, h * 1.16, w * 0.45, h * 1.33, w, 0.002)
    .bezierCurveTo(w * 0.69, -h * 0.9, -w * 0.7, -h, -w, -0.004);
  facePatch(eye, lens(0.073, 0.046), flat(COLORS.brow), x, y, 0.013);
  facePatch(eye, lens(0.067, 0.04), flat(COLORS.eyeWhite), x, y - 0.006, 0.019);
  facePatch(eye, ellipse(-side * 0.009, -0.004, 0.033, 0.036), flat(COLORS.irisEdge), x, y, 0.024);
  facePatch(eye, ellipse(-side * 0.009, -0.007, 0.027, 0.031), flat(COLORS.iris), x, y, 0.026);
  facePatch(eye, ellipse(-side * 0.009, -0.003, 0.015, 0.023), flat(COLORS.pupil), x, y, 0.028);
  facePatch(eye, ellipse(-side * 0.009 - 0.01, 0.011, 0.009, 0.011), flat(0xfff8ec), x, y, 0.03);
  facePatch(eye, ellipse(-side * 0.009 + 0.012, -0.017, 0.004, 0.005), flat(0xe8a87b), x, y, 0.03);
  return eye;
}

function makeBrow(head, side) {
  const brow = new THREE.Group();
  const x = side * 0.105;
  const y = side < 0 ? 0.114 : 0.122;
  brow.position.set(x, y, faceDepth(x, y));
  head.add(brow);
  const shape = new THREE.Shape()
    .moveTo(-side * 0.057, -0.007)
    .bezierCurveTo(-side * 0.028, 0.03, side * 0.04, 0.026, side * 0.065, -0.002)
    .bezierCurveTo(side * 0.02, 0.011, -side * 0.031, 0.004, -side * 0.057, -0.013);
  facePatch(brow, shape, flat(COLORS.brow), x, y, 0.012);
  return brow;
}

function makeHand(parent, skin, side, length) {
  const hand = new THREE.Group();
  hand.position.y = -length;
  parent.add(hand);
  oval(hand, 0.047, 0.054, 0.029, skin, { pos: [0, -0.026, 0], ink: 0.035 });

  const fingers = [];
  const lengths = [0.046, 0.057, 0.053, 0.04];
  for (let i = 0; i < lengths.length; i++) {
    const digit = new THREE.Group();
    digit.position.set(side * (i - 1.5) * 0.022, -0.052 + (i === 3 ? 0.008 : 0), 0.002);
    digit.rotation.z = side * (i - 1.5) * 0.07;
    hand.add(digit);
    part(digit, new THREE.CapsuleGeometry(0.011, lengths[i] - 0.022, 4, 10), skin, {
      pos: [0, -lengths[i] / 2 + 0.006, 0],
    });
    fingers.push(digit);
  }
  oval(hand, 0.016, 0.035, 0.017, skin, {
    pos: [-side * 0.04, -0.026, 0.008], rot: [0, 0, -side * 0.48],
  });
  return { hand, fingers };
}

function makeSneaker(parent, materials, side) {
  const { shoe, rubber, outsole, trim } = materials;
  const foot = new THREE.Group();
  foot.position.y = -0.282;
  parent.add(foot);
  part(foot, new RoundedBoxGeometry(0.157, 0.023, 0.259, 4, 0.011), outsole, {
    pos: [0, -0.038, 0.059], ink: 0.04,
  });
  part(foot, new RoundedBoxGeometry(0.16, 0.026, 0.26, 4, 0.012), rubber, { pos: [0, -0.018, 0.059] });
  oval(foot, 0.08, 0.034, 0.121, shoe, { pos: [0, 0.005, 0.059] });
  oval(foot, 0.068, 0.045, 0.078, shoe, { pos: [0, 0.026, 0.011] });
  const stripe = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.068, 0.024, -0.027),
    new THREE.Vector3(side * 0.079, 0.015, 0.045),
    new THREE.Vector3(side * 0.071, 0.021, 0.113),
  ]);
  part(foot, new THREE.TubeGeometry(stripe, 14, 0.0055, 8), trim);
  for (let i = 0; i < 3; i++) {
    part(foot, new THREE.CapsuleGeometry(0.0038, 0.059 - i * 0.006, 4, 10), rubber, {
      pos: [0, 0.071 - i * 0.008, 0.035 + i * 0.02], rot: [0, 0, Math.PI / 2],
    });
  }
}

const POSES = {
  idle: { head: [0.015, 0, -0.025], curl: 0.95 },
  thinking: { head: [0.13, 0.22, -0.05], rShoulder: [-0.829, -0.464, 0.826], rElbow: [-2.198, -0.267, 0.13], browR: 0.09, browL: -0.08, curl: 1.1 },
  speaking: { head: [0.02, 0.055, 0.01], rShoulder: [-0.26, -0.06, 0.23], lShoulder: [-0.2, 0.06, -0.19], rElbow: [-0.45, 0.12, -0.15], lElbow: [-0.38, -0.12, 0.08], curl: 0.63 },
  waving: { head: [0, 0.04, -0.08], torso: [0, 0, 0.045], rShoulder: [-0.21, -0.12, 1.78], rElbow: [-0.22, 0, 0.62], browR: 0.08, curl: 0.2 },
  error: { head: [0.09, -0.095, -0.1], rShoulder: [-0.24, -0.1, 0.29], lShoulder: [-0.25, 0.1, -0.29], rElbow: [-0.62, 0, 0], lElbow: [-0.62, 0, 0], browL: -0.14, browR: -0.06, curl: 0.83 },
};
const REST = [0, 0, 0];

export function createAnimeMascot() {
  const root = new THREE.Group();
  root.name = 'animeRoot';
  const skin = toon(COLORS.skin);
  const trim = toon(COLORS.trim);
  const shirt = toon(ACCENT);
  const pants = toon(COLORS.pants);
  const shoes = { trim, shoe: toon(COLORS.shoe), rubber: toon(COLORS.rubber), outsole: toon(COLORS.outsole) };
  const joints = {};
  const hands = [];
  const track = (name, object, base = REST) => {
    object.name = name;
    joints[name] = { object, base, rotation: new THREE.Vector3() };
  };

  const hips = new THREE.Group();
  hips.name = 'hips';
  hips.position.y = 0.775;
  root.add(hips);
  part(hips, profileGeometry([
    [-0.151, 0], [-0.13, 0.09], [-0.09, 0.161], [-0.032, 0.176], [0.06, 0.148], [0.07, 0],
  ], 0.79), pants);

  const torso = new THREE.Group();
  torso.position.y = 0.045;
  hips.add(torso);
  track('torso', torso);
  part(torso, profileGeometry([
    [-0.04, 0], [-0.039, 0.14], [-0.008, 0.164], [0.099, 0.169], [0.25, 0.199],
    [0.34, 0.213], [0.392, 0.18], [0.434, 0.102], [0.442, 0],
  ], 0.71), shirt);
  part(torso, profileGeometry([
    [-0.03, 0.153], [-0.024, 0.162], [0.01, 0.169], [0.017, 0.163],
  ], 0.73), trim);

  const neck = new THREE.Group();
  neck.position.y = 0.431;
  torso.add(neck);
  part(neck, new THREE.CylinderGeometry(0.074, 0.091, 0.132, 32), skin, {
    pos: [0, 0.053, 0.004], scale: [1, 1, 0.85],
  });
  part(neck, new THREE.TorusGeometry(0.089, 0.014, 12, 40), trim, {
    pos: [0, -0.005, 0.002], rot: [Math.PI / 2, 0, 0], scale: [1, 0.83, 1],
  });

  const head = new THREE.Group();
  head.position.y = 0.341;
  neck.add(head);
  track('head', head);
  part(head, headGeometry(), skin, { ink: 0.019 });
  part(head, hairGeometry(), toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
  const ear = toon(COLORS.ear);
  const eyes = [];
  for (const side of [-1, 1]) {
    oval(head, 0.043, 0.058, 0.035, skin, {
      pos: [side * 0.267, -0.024, 0.029], rot: [0, side * 0.32, side * 0.2], ink: 0.035,
    });
    oval(head, 0.018, 0.034, 0.008, ear, {
      pos: [side * 0.277, -0.023, 0.06], rot: [0, side * 0.45, side * 0.25],
    });
    eyes.push(makeEye(head, side));
    track(side > 0 ? 'browR' : 'browL', makeBrow(head, side));
  }

  const noseShadow = new THREE.Shape()
    .moveTo(-0.021, -0.043)
    .bezierCurveTo(-0.016, -0.061, 0.007, -0.062, 0.02, -0.046)
    .bezierCurveTo(0.008, -0.052, -0.01, -0.051, -0.021, -0.043);
  facePatch(head, noseShadow, flat(0xb86f53, { transparent: true, opacity: 0.52 }), 0, 0, 0.004);

  const mouth = new THREE.Group();
  mouth.name = 'mouth';
  mouth.position.set(0, -0.127, faceDepth(0, -0.127));
  head.add(mouth);
  const smileMat = flat(COLORS.mouth, { transparent: true, depthWrite: false });
  const openMat = flat(0x522b30, { transparent: true, opacity: 0, depthWrite: false });
  const smileShape = new THREE.Shape()
    .moveTo(-0.057, 0.003)
    .bezierCurveTo(-0.028, -0.022, 0.029, -0.02, 0.061, 0.015)
    .bezierCurveTo(0.065, 0.017, 0.067, 0.012, 0.063, 0.007)
    .bezierCurveTo(0.028, -0.034, -0.031, -0.03, -0.061, -0.002)
    .quadraticCurveTo(-0.064, 0.006, -0.057, 0.003);
  facePatch(mouth, smileShape, smileMat, 0, -0.127, 0.008);
  const openMouth = facePatch(mouth, ellipse(0, 0, 0.049, 0.024), openMat, 0, -0.127, 0.01);

  for (const side of [-1, 1]) {
    const label = side > 0 ? 'r' : 'l';
    const { upper: shoulder, lower: elbow } = limb(torso, shirt, [side * 0.188, 0.34, 0], 0.266, 0.087, 0.91, [
      [-0.524, 0], [-0.516, 0.044], [-0.488, 0.053], [-0.36, 0.065], [-0.265, 0.065],
      [-0.16, 0.077], [-0.045, 0.087], [0.025, 0.074], [0.064, 0.033], [0.07, 0],
    ]);
    track(label + 'Shoulder', shoulder, [0, 0, side * 0.16]);
    track(label + 'Elbow', elbow, [-0.04, 0, 0]);
    part(elbow, profileGeometry([[-0.252, 0.046], [-0.248, 0.05], [-0.216, 0.056], [-0.211, 0.054]], 0.92), trim);
    const gestureHand = makeHand(elbow, skin, side, 0.252);
    gestureHand.hand.name = label + 'Hand';
    hands.push(gestureHand);

    const { lower: knee } = limb(hips, pants, [side * 0.095, -0.073, 0], 0.37, 0.09, 0.87, [
      [-0.665, 0], [-0.658, 0.057], [-0.545, 0.059], [-0.43, 0.065], [-0.372, 0.069],
      [-0.23, 0.077], [-0.075, 0.086], [0.038, 0.084], [0.083, 0],
    ]);
    makeSneaker(knee, shoes, side);
  }

  let state = 'idle';
  let stateTime = 0;
  let blinkAt = 2.4;
  let blinkStart = -1;
  let lastTime = 0;
  const blinkLength = 0.14;

  function setState(name) {
    if (!Object.hasOwn(POSES, name)) return false;
    if (state !== name) stateTime = 0;
    state = name;
    return true;
  }

  function update(dt, t) {
    dt = THREE.MathUtils.clamp(dt, 0, 0.05);
    lastTime = t;
    stateTime += dt;
    const pose = POSES[state];
    const k = 1 - Math.exp(-dt * 10);

    for (const [name, joint] of Object.entries(joints)) {
      const { object, base, rotation } = joint;
      const target = pose[name] ?? REST;
      const [x, y, z] = Array.isArray(target) ? target : [0, 0, target];
      rotation.x += (base[0] + x - rotation.x) * k;
      rotation.y += (base[1] + y - rotation.y) * k;
      rotation.z += (base[2] + z - rotation.z) * k;
      object.rotation.set(rotation.x, rotation.y, rotation.z);
    }

    torso.position.y = 0.045 + Math.sin(t * 1.75) * 0.003;
    head.rotation.y += Math.sin(t * 0.8) * 0.02;
    const wave = state === 'waving' ? Math.sin(stateTime * 11) * 0.27 * Math.min(1, stateTime * 4) : 0;
    for (const { hand, fingers } of hands) {
      const right = hand.name === 'rHand';
      hand.rotation.z += ((right ? wave : 0) - hand.rotation.z) * k;
      const curl = !right && state === 'waving' ? POSES.idle.curl : pose.curl;
      fingers.forEach((finger, i) => {
        finger.rotation.x += (-curl * (0.8 + i * 0.07) - finger.rotation.x) * k;
      });
    }

    const speaking = state === 'speaking';
    const cadence = Math.sin(t * 8.1 + 0.6 * Math.sin(t * 3.2));
    const syllable = speaking ? 0.31 + 0.78 * cadence ** 2 : 0.2;
    const mouthK = 1 - Math.exp(-dt * 18);
    openMouth.scale.y += (syllable - openMouth.scale.y) * mouthK;
    openMouth.scale.x += ((speaking ? 1 - 0.08 * cadence : 1) - openMouth.scale.x) * mouthK;
    openMat.opacity += ((speaking ? 1 : 0) - openMat.opacity) * mouthK;
    smileMat.opacity += ((speaking ? 0 : 1) - smileMat.opacity) * mouthK;
    if (speaking) head.rotation.x += Math.sin(t * 5) * 0.026;
    root.position.x = state === 'error' ? Math.sin(stateTime * 26) * 0.009 * Math.exp(-stateTime * 2) : 0;

    if (blinkStart < 0 && t > blinkAt) blinkStart = t;
    let eyeScale = 1;
    if (blinkStart >= 0) {
      const progress = (t - blinkStart) / blinkLength;
      if (progress >= 1) {
        blinkStart = -1;
        blinkAt = t + 2.4 + Math.random() * 3;
      } else {
        eyeScale = 1 - 0.94 * Math.sin(progress * Math.PI);
      }
    }
    for (const eye of eyes) eye.scale.y = eyeScale;
  }

  return {
    root,
    parts: { head, mouth, eyes },
    update,
    setState,
    get state() { return state; },
    blink: () => { if (blinkStart < 0) blinkStart = lastTime - blinkLength * 0.37; },
  };
}
