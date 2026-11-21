import * as THREE from 'three';

export const ACCENT = 0x22c55e;

export const COLORS = {
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

export const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra });
export const flat = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
const outline = flat(COLORS.ink, { side: THREE.BackSide });

export function part(parent, geometry, material, { pos, rot, scale, ink = 0 } = {}) {
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

export function oval(parent, x, y, z, material, options = {}) {
  return part(parent, new THREE.SphereGeometry(1, 24, 16), material, { ...options, scale: [x, y, z] });
}

export function profileGeometry(profile, depth) {
  const curve = new THREE.SplineCurve(profile.map(([y, radius]) => new THREE.Vector2(radius, y)));
  const points = curve.getPoints(44);
  for (const point of points) point.x = Math.max(0.0001, point.x);
  return new THREE.LatheGeometry(points, 32).scale(1, 1, depth);
}

// Each sleeve and trouser leg is one surface. Vertices around the bend share
// both bones so the fabric closes over the elbow or knee throughout a gesture.
export function limb(parent, material, pos, length, blendWidth, depth, profile) {
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

export const HEAD = { width: 0.291, height: 0.29, depth: 0.252 };
const jawWidth = y => 1 - 0.16 * THREE.MathUtils.smoothstep(-y, 0.02, HEAD.height);

function faceRelief(x, y) {
  const bridge = Math.exp(-((x / 0.023) ** 2) - (((y + 0.006) / 0.055) ** 2));
  const tip = Math.exp(-((x / 0.031) ** 2) - (((y + 0.04) / 0.019) ** 2));
  const chin = Math.exp(-((x / 0.09) ** 2) - (((y + 0.195) / 0.058) ** 2));
  return 0.013 * bridge + 0.031 * tip + 0.009 * chin;
}

export function faceDepth(x, y) {
  const normalizedX = x / (HEAD.width * jawWidth(y));
  const normalizedY = y / HEAD.height;
  const z = Math.sqrt(Math.max(0, 1 - normalizedX ** 2 - normalizedY ** 2));
  return HEAD.depth * z + z * faceRelief(x, y);
}

export function headGeometry() {
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

export function hairGeometry() {
  const slices = 112;
  const rings = 48;
  const geometry = new THREE.SphereGeometry(1, slices, rings, 0, Math.PI * 2, 0, Math.PI / 2);
  const points = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const colors = new Float32Array(points.count * 3);
  const baseColor = new THREE.Color(COLORS.hair);
  const fadeColor = new THREE.Color(COLORS.fade);
  const sheen = new THREE.Color(0x89604a);
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
    const edge = 1.68 - front * 0.65 + frontWeight * (-0.045 * fringe - 0.17 * part) + 0.16 * nape;
    const phi = t * edge;
    const edgeBlend = THREE.MathUtils.smoothstep(t, 0.94, 1);
    const crown = 1 - THREE.MathUtils.smoothstep(phi, 0.8, 1.66);
    const poleBlend = THREE.MathUtils.smoothstep(phi, 0, 0.48);
    const flow = angle * 5 + phi * 8.2 + 1.12 * Math.sin(angle);
    const strand = 0.5 + 0.5 * Math.cos(flow);
    const lock = strand ** 2.6 * poleBlend * (0.53 + 0.47 * frontWeight);
    const groove = (0.5 - 0.5 * Math.cos(flow)) ** 10 * poleBlend;
    const lift = 0.008 + crown * (0.027 - 0.018 * sweep * poleBlend + 0.039 * lock - 0.006 * groove);
    const shell = THREE.MathUtils.lerp(lift, -0.003, edgeBlend);
    const y = Math.cos(phi) * (HEAD.height + shell);
    const x = Math.sin(angle) * Math.sin(phi) * (HEAD.width * jawWidth(y) + shell);
    const z = Math.cos(angle) * Math.sin(phi) * (HEAD.depth + shell);
    points.setXYZ(i, x, y, z);

    const fadedEdge = (1 - frontWeight) * THREE.MathUtils.smoothstep(phi, 1.04, edge);
    color.copy(baseColor).lerp(sheen, 0.55 * lock * crown).multiplyScalar(1 - 0.16 * groove * crown).lerp(fadeColor, 0.9 * fadedEdge);
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  // The longitude seam shares a position but has separate UV vertices.
  const normals = geometry.attributes.normal;
  const normal = new THREE.Vector3();
  for (let i = 0; i <= slices; i++) normals.setXYZ(i, 0, 1, 0);
  for (let row = 1; row <= rings; row++) {
    const first = row * (slices + 1);
    const last = first + slices;
    normal.set(normals.getX(first) + normals.getX(last), normals.getY(first) + normals.getY(last), normals.getZ(first) + normals.getZ(last)).normalize();
    normals.setXYZ(first, normal.x, normal.y, normal.z);
    normals.setXYZ(last, normal.x, normal.y, normal.z);
  }
  return geometry;
}

// Split long triangles before projecting them, so the eyes hug the face
// without having to hover above the convex surface to stay visible.
export function facePatch(parent, shape, material, x, y, offset) {
  const plane = new THREE.ShapeGeometry(shape, 16);
  const points = plane.attributes.position;
  const positions = [];
  const project = (point) => {
    const z = faceDepth(x + point.x, y + point.y) - parent.position.z + offset;
    positions.push(point.x, point.y, z);
  };
  const midpoint = (a, b) => a.clone().add(b).multiplyScalar(0.5);
  function split(a, b, c, levels) {
    if (levels === 0) {
      project(a);
      project(b);
      project(c);
      return;
    }
    const ab = midpoint(a, b);
    const bc = midpoint(b, c);
    const ca = midpoint(c, a);
    split(a, ab, ca, levels - 1);
    split(ab, b, bc, levels - 1);
    split(ca, bc, c, levels - 1);
    split(ab, bc, ca, levels - 1);
  }
  const vertex = index => new THREE.Vector2(points.getX(index), points.getY(index));
  const indices = plane.index.array;
  for (let i = 0; i < indices.length; i += 3) {
    split(vertex(indices[i]), vertex(indices[i + 1]), vertex(indices[i + 2]), 2);
  }
  plane.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return part(parent, geometry, material, { pos: [x - parent.position.x, y - parent.position.y, 0] });
}

export function ellipse(x, y, width, height) {
  return new THREE.Shape().absellipse(x, y, width, height, 0, Math.PI * 2, false);
}

export function makeEye(head, side) {
  const eye = new THREE.Group();
  const x = side * 0.108;
  const y = 0.047;
  eye.position.set(x, y, faceDepth(x, y));
  head.add(eye);

  const lens = (w, h) => new THREE.Shape()
    .moveTo(-w, -0.004)
    .bezierCurveTo(-w * 0.68, h * 1.16, w * 0.45, h * 1.33, w, 0.002)
    .bezierCurveTo(w * 0.69, -h * 0.9, -w * 0.7, -h, -w, -0.004);
  facePatch(eye, lens(0.073, 0.046), flat(COLORS.brow), x, y, 0.0038);
  facePatch(eye, lens(0.067, 0.04), flat(COLORS.eyeWhite), x, y - 0.005, 0.0055);
  const irisX = -side * 0.006;
  // The iris layers live in their own group so a gaze offset can slide them
  // across the eye white without moving the lids or the eye outline.
  const gazeParts = [
    facePatch(eye, ellipse(irisX, -0.004, 0.033, 0.035), flat(COLORS.irisEdge), x, y, 0.007),
    facePatch(eye, ellipse(irisX, -0.007, 0.028, 0.03), flat(COLORS.iris), x, y, 0.008),
    facePatch(eye, ellipse(irisX, -0.003, 0.015, 0.023), flat(COLORS.pupil), x, y, 0.009),
    facePatch(eye, ellipse(irisX - 0.01, 0.011, 0.008, 0.01), flat(0xfff8ec), x, y, 0.01),
    facePatch(eye, ellipse(irisX + 0.012, -0.017, 0.004, 0.005), flat(0xe8a87b), x, y, 0.01),
  ];
  const gaze = new THREE.Group();
  gaze.name = side > 0 ? 'rGaze' : 'lGaze';
  eye.add(gaze);
  for (const iris of gazeParts) gaze.add(iris);

  const closedShape = new THREE.Shape()
    .moveTo(-0.066, -0.005)
    .quadraticCurveTo(-0.004, 0.026, 0.068, -0.003)
    .quadraticCurveTo(0.004, 0.013, -0.066, -0.005);
  const lid = facePatch(head, closedShape, flat(COLORS.brow), x, y - 0.011, 0.0048);
  lid.name = side > 0 ? 'rClosedLid' : 'lClosedLid';
  lid.visible = false;
  return { eye, lid, gaze };
}

export function makeBrow(head, side) {
  const brow = new THREE.Group();
  const x = side * 0.105;
  const y = side < 0 ? 0.114 : 0.122;
  brow.position.set(x, y, faceDepth(x, y));
  head.add(brow);
  const shape = new THREE.Shape()
    .moveTo(-side * 0.057, -0.007)
    .bezierCurveTo(-side * 0.028, 0.03, side * 0.04, 0.026, side * 0.065, -0.002)
    .bezierCurveTo(side * 0.02, 0.011, -side * 0.031, 0.004, -side * 0.057, -0.013);
  facePatch(brow, shape, flat(COLORS.brow), x, y, 0.008);
  return brow;
}

export function makeHand(parent, skin, side, length) {
  const hand = new THREE.Group();
  hand.position.y = -length;
  parent.add(hand);
  oval(hand, 0.047, 0.054, 0.029, skin, { pos: [0, -0.026, 0], ink: 0.035 });

  const fingers = [];
  const lengths = [0.05, 0.062, 0.055, 0.041];
  for (let i = 0; i < lengths.length; i++) {
    const digit = new THREE.Group();
    digit.position.set(side * (i - 1.5) * 0.022, -0.052 + (i === 3 ? 0.008 : 0), 0.002);
    digit.rotation.z = side * (i - 1.5) * 0.1;
    hand.add(digit);
    part(digit, new THREE.CapsuleGeometry(0.011, lengths[i] - 0.022, 4, 10), skin, {
      pos: [0, -lengths[i] / 2 + 0.006, 0],
    });
    fingers.push(digit);
  }
  oval(hand, 0.016, 0.035, 0.017, skin, {
    pos: [-side * 0.043, -0.026, 0.008], rot: [0, 0, -side * 0.59],
  });
  return { hand, fingers };
}

export function makePointer() {
  const pointer = new THREE.Group();
  pointer.name = 'teachingPointer';
  pointer.position.set(0, -0.043, 0.034);
  const grip = toon(0x183e32);
  const shaft = toon(0xcba977);
  const accent = toon(ACCENT);
  part(pointer, new THREE.CapsuleGeometry(0.017, 0.085, 4, 16), grip, { pos: [0, 0.01, 0] });
  part(pointer, new THREE.CylinderGeometry(0.011, 0.007, 0.338, 16), shaft, { pos: [0, -0.203, 0] });
  part(pointer, new THREE.CylinderGeometry(0.018, 0.017, 0.016, 16), accent, { pos: [0, -0.039, 0] });
  const tip = oval(pointer, 0.009, 0.018, 0.009, accent, { pos: [0, -0.371, 0] });
  tip.name = 'pointerTip';
  pointer.visible = false;
  return pointer;
}

function soleGeometry(thickness, bevel) {
  const sole = new THREE.Shape()
    .moveTo(0, -0.123)
    .bezierCurveTo(0.05, -0.123, 0.073, -0.106, 0.073, -0.065)
    .bezierCurveTo(0.073, -0.013, 0.06, 0.054, 0.057, 0.094)
    .quadraticCurveTo(0.056, 0.116, 0, 0.116)
    .quadraticCurveTo(-0.056, 0.116, -0.057, 0.094)
    .bezierCurveTo(-0.06, 0.054, -0.073, -0.013, -0.073, -0.065)
    .bezierCurveTo(-0.073, -0.106, -0.05, -0.123, 0, -0.123);
  const depth = thickness - bevel * 2;
  return new THREE.ExtrudeGeometry(sole, {
    depth, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 9,
  }).translate(0, 0, -depth / 2).rotateX(-Math.PI / 2);
}

export function makeSneaker(parent, materials, side) {
  const { shoe, rubber, outsole, trim } = materials;
  const foot = new THREE.Group();
  foot.name = side > 0 ? 'footR' : 'footL';
  foot.position.y = -0.282;
  parent.add(foot);
  foot.rotation.y = side * 0.045;
  part(foot, soleGeometry(0.023, 0.006), outsole, { pos: [0, -0.038, 0.048] });
  part(foot, soleGeometry(0.026, 0.008), rubber, { pos: [0, -0.019, 0.048] });
  oval(foot, 0.075, 0.036, 0.118, shoe, { pos: [0, 0.004, 0.046] });
  oval(foot, 0.063, 0.046, 0.078, shoe, { pos: [0, 0.025, 0.008] });
  const stripe = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.058, 0.024, -0.027),
    new THREE.Vector3(side * 0.071, 0.017, 0.042),
    new THREE.Vector3(side * 0.063, 0.015, 0.102),
  ]);
  part(foot, new THREE.TubeGeometry(stripe, 14, 0.0055, 8), trim);
  for (let i = 0; i < 3; i++) {
    part(foot, new THREE.CapsuleGeometry(0.0038, 0.059 - i * 0.006, 4, 10), rubber, {
      pos: [0, 0.071 - i * 0.008, 0.035 + i * 0.02], rot: [0, 0, Math.PI / 2],
    });
  }
  return foot;
}

export const POSES = {
  idle: { head: [0.015, 0, -0.025], curl: 0.95 },
  thinking: { head: [0.13, 0.22, -0.05], rShoulder: [-0.829, -0.464, 0.826], rElbow: [-2.198, -0.267, 0.13], browR: 0.07, browL: 0.15, curl: 1.1 },
  speaking: { head: [0.02, 0.055, 0.01], rShoulder: [-0.26, -0.06, 0.23], lShoulder: [-0.2, 0.06, -0.19], rElbow: [-0.45, 0.12, -0.15], lElbow: [-0.38, -0.12, 0.08], curl: 0.63 },
  waving: { head: [0, 0.04, -0.08], torso: [0, 0, 0.045], rShoulder: [-0.21, -0.12, 1.78], rElbow: [-0.22, 0, 0.62], rHand: [0, -0.26, 0], browR: 0.08, curl: 0.2 },
  error: { head: [0.09, -0.095, -0.1], rShoulder: [-0.24, -0.1, 0.29], lShoulder: [-0.25, 0.1, -0.29], rElbow: [-0.62, 0, 0], lElbow: [-0.62, 0, 0], browL: 0.24, browR: -0.22, curl: 0.83 },
  presenting: {
    head: [-0.035, 0.09, -0.035], torso: [0, 0.08, 0.015],
    rShoulder: [-0.35, -0.12, 0.66], rElbow: [-0.60, -0.15, 0.35], rHand: [0.30, -1.05, 0.08],
    lShoulder: [-0.12, 0, -0.08], lElbow: [-0.12, 0, 0], browR: 0.08, curl: 0.26, leftCurl: 0.8,
  },
  'point-left': {
    head: [-0.06, -0.22, 0.025], torso: [0, -0.09, 0], point: 'l',
    lShoulder: [-0.12, 0.03, -1.09], lElbow: [-0.17, -0.13, -0.28],
    curl: 0.85,
  },
  'point-right': {
    head: [-0.06, 0.22, -0.025], torso: [0, 0.09, 0], point: 'r',
    rShoulder: [-0.12, -0.03, 1.09], rElbow: [-0.17, 0.13, 0.28],
    curl: 0.85,
  },
  comparing: {
    head: [-0.015, 0, -0.03], rShoulder: [-0.30, -0.10, 0.62], lShoulder: [-0.28, 0.10, -0.62],
    rElbow: [-0.62, -0.13, 0.30], lElbow: [-0.62, 0.13, -0.30],
    rHand: [0.34, -0.95, 0.04], lHand: [0.34, 0.95, -0.04], curl: 0.25,
  },
  nodding: { head: [0.01, 0, -0.018], browL: 0.05, curl: 0.85 },
  celebrating: {
    head: [-0.12, 0.025, -0.06], rShoulder: [-0.16, -0.1, 1.68], lShoulder: [-0.1, 0.09, -1.55],
    rElbow: [-0.18, 0, 0.53], lElbow: [-0.38, 0, -0.55],
    browR: 0.12, browL: -0.10, curl: 1.5,
  },
};
export const REST = [0, 0, 0];

export function createAnimeMascot() {
  const root = new THREE.Group();
  root.name = 'animeRoot';
  const skin = toon(COLORS.skin);
  const trim = toon(COLORS.trim);
  const shirt = toon(ACCENT);
  const pants = toon(COLORS.pants);
  const shoes = { trim, shoe: toon(COLORS.shoe), rubber: toon(COLORS.rubber), outsole: toon(COLORS.outsole) };
  const joints = {};
  const hands = {};
  const pointer = makePointer();
  let talkOverride = null;
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
  part(neck, new THREE.CylinderGeometry(0.074, 0.087, 0.123, 32), skin, {
    pos: [0, 0.058, 0.004], scale: [1, 1, 0.85],
  });
  part(neck, new THREE.TorusGeometry(0.089, 0.014, 12, 40), trim, {
    pos: [0, -0.005, 0.002], rot: [Math.PI / 2, 0, 0], scale: [1, 0.83, 1],
  });

  const head = new THREE.Group();
  head.position.y = 0.341;
  neck.add(head);
  track('head', head);
  part(head, headGeometry(), skin, { ink: 0.019 });
  const hair = part(head, hairGeometry(), toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
  hair.name = 'hair';
  const face = new THREE.Group();
  head.add(face);
  const ear = toon(COLORS.ear);
  const eyes = [];
  const lids = [];
  for (const side of [-1, 1]) {
    oval(head, 0.043, 0.058, 0.035, skin, {
      pos: [side * 0.267, -0.024, 0.029], rot: [0, side * 0.32, side * 0.2], ink: 0.035,
    });
    oval(head, 0.018, 0.034, 0.008, ear, {
      pos: [side * 0.277, -0.023, 0.06], rot: [0, side * 0.45, side * 0.25],
    });
    const { eye, lid } = makeEye(face, side);
    eyes.push(eye);
    lids.push(lid);
    track(side > 0 ? 'browR' : 'browL', makeBrow(face, side));
  }

  const noseShadow = new THREE.Shape()
    .moveTo(-0.021, -0.043)
    .bezierCurveTo(-0.016, -0.061, 0.007, -0.062, 0.02, -0.046)
    .bezierCurveTo(0.008, -0.052, -0.01, -0.051, -0.021, -0.043);
  facePatch(face, noseShadow, flat(0xb86f53, { transparent: true, opacity: 0.52 }), 0, 0, 0.004);

  const mouth = new THREE.Group();
  mouth.name = 'mouth';
  mouth.position.set(0, -0.127, faceDepth(0, -0.127));
  face.add(mouth);
  const smileMat = flat(COLORS.mouth, { transparent: true, depthWrite: false });
  const expressionMaterial = color => flat(color, { transparent: true, opacity: 0, depthWrite: false });
  const openMat = expressionMaterial(0x45252b);
  const teethMat = expressionMaterial(0xffecd5);
  const tongueMat = expressionMaterial(0xc36968);
  const thinkMat = expressionMaterial(COLORS.mouth);
  const worriedMat = expressionMaterial(COLORS.mouth);
  const smileShape = new THREE.Shape()
    .moveTo(-0.057, 0.003)
    .bezierCurveTo(-0.028, -0.022, 0.029, -0.02, 0.061, 0.015)
    .bezierCurveTo(0.065, 0.017, 0.067, 0.012, 0.063, 0.007)
    .bezierCurveTo(0.028, -0.034, -0.031, -0.03, -0.061, -0.002)
    .quadraticCurveTo(-0.064, 0.006, -0.057, 0.003);
  facePatch(mouth, smileShape, smileMat, 0, -0.127, 0.008);
  const openShape = new THREE.Shape()
    .moveTo(-0.055, 0.007)
    .bezierCurveTo(-0.027, 0.033, 0.034, 0.03, 0.055, 0.008)
    .bezierCurveTo(0.027, -0.049, -0.032, -0.043, -0.055, 0.007);
  const openMouth = facePatch(mouth, openShape, openMat, 0, -0.127, 0.008);
  const teeth = new THREE.Shape()
    .moveTo(-0.034, 0.014)
    .quadraticCurveTo(0, 0.032, 0.035, 0.014)
    .quadraticCurveTo(0, 0.002, -0.034, 0.014);
  const upperTeeth = facePatch(mouth, teeth, teethMat, 0, -0.127, 0.0105);
  const tongue = facePatch(mouth, ellipse(0, -0.015, 0.020, 0.007), tongueMat, 0, -0.127, 0.0105);
  upperTeeth.renderOrder = tongue.renderOrder = 1;
  openMouth.add(upperTeeth, tongue);

  const thinkingMouth = facePatch(mouth, ellipse(0.011, 0.003, 0.027, 0.004), thinkMat, 0, -0.127, 0.005);
  thinkingMouth.name = 'thinkingMouth';
  const worried = new THREE.Shape()
    .moveTo(-0.046, -0.011)
    .quadraticCurveTo(-0.002, 0.032, 0.046, -0.005)
    .quadraticCurveTo(-0.002, 0.014, -0.046, -0.011);
  const worriedMouth = facePatch(mouth, worried, worriedMat, 0, -0.127, 0.0048);
  worriedMouth.name = 'worriedMouth';

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
    hands[label] = gestureHand;

    const { lower: knee } = limb(hips, pants, [side * 0.095, -0.073, 0], 0.37, 0.09, 0.87, [
      [-0.665, 0], [-0.658, 0.057], [-0.545, 0.059], [-0.43, 0.065], [-0.372, 0.069],
      [-0.23, 0.077], [-0.075, 0.086], [0.038, 0.084], [0.083, 0],
    ]);
    makeSneaker(knee, shoes, side);
  }

  hands.r.hand.add(pointer);
  let state = 'idle';
  let stateTime = 0;
  let blinkAt = 2.4;
  let blinkStart = null;
  let lastTime = 0;
  const blinkLength = 0.14;

  function setState(name) {
    if (!Object.hasOwn(POSES, name)) return false;
    if (state !== name || name === 'nodding' || name === 'celebrating') stateTime = 0;
    if (name === 'speaking') talkOverride = null;
    state = name;
    mountPointer();
    return true;
  }

  function mountPointer() {
    const side = POSES[state].point ?? (state === 'thinking' ? 'l' : 'r');
    if (pointer.parent !== hands[side].hand) hands[side].hand.add(pointer);
  }

  function setPointer(enabled) {
    pointer.visible = Boolean(enabled);
  }

  const isTalking = () => talkOverride ?? (state === 'speaking');

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
    for (const [side, { hand, fingers }] of Object.entries(hands)) {
      const [x, y, z] = pose[hand.name] ?? REST;
      const gripping = pointer.visible && pointer.parent === hand;
      const pointing = pose.point === side;
      const curl = side === 'l' ? (pose.leftCurl ?? (state === 'waving' ? POSES.idle.curl : pose.curl)) : pose.curl;
      hand.rotation.x += ((gripping ? 0 : x) - hand.rotation.x) * k;
      hand.rotation.y += ((gripping ? y * 0.30 : y) - hand.rotation.y) * k;
      hand.rotation.z += (z + (side === 'r' ? wave : 0) - hand.rotation.z) * k;
      fingers.forEach((finger, i) => {
        const bend = gripping ? 1.6 : pointing ? (i === 0 ? 0.04 : 1.65) : curl;
        finger.rotation.x += (-bend * (0.8 + i * 0.07) - finger.rotation.x) * k;
      });
    }
    const pointerAngle = pose.point ? 0 : pointer.parent === hands.r.hand ? 0.09 : -0.09;
    pointer.rotation.z += (pointerAngle - pointer.rotation.z) * k;

    const nodTime = Math.min(1, stateTime / 0.72);
    if (state === 'nodding') head.rotation.x += 0.23 * Math.sin(Math.PI * nodTime) ** 2;
    if (state === 'celebrating') {
      const cheer = Math.sin(10 * stateTime) * Math.exp(-stateTime * 2.2);
      joints.rElbow.object.rotation.z += 0.22 * cheer;
      joints.lElbow.object.rotation.z -= 0.22 * cheer;
    }
    if (state === 'comparing') {
      const shift = Math.sin(stateTime * 2.4) * 0.11 * Math.min(1, stateTime * 4);
      head.rotation.y += shift;
      joints.rElbow.object.rotation.x += shift * 0.8;
      joints.lElbow.object.rotation.x -= shift * 0.8;
    }

    const speaking = isTalking();
    const cadence = Math.sin(t * 8.1 + 0.6 * Math.sin(t * 3.2));
    const syllable = speaking ? 0.31 + 0.78 * cadence ** 2 : 0.2;
    const mouthK = 1 - Math.exp(-dt * 18);
    openMouth.scale.y += (syllable - openMouth.scale.y) * mouthK;
    openMouth.scale.x += ((speaking ? 1 - 0.08 * cadence : 1) - openMouth.scale.x) * mouthK;
    openMat.opacity += ((speaking ? 1 : 0) - openMat.opacity) * mouthK;
    teethMat.opacity = openMat.opacity * THREE.MathUtils.smoothstep(openMouth.scale.y, 0.3, 0.63);
    tongueMat.opacity = openMat.opacity;
    const smiling = !speaking && state !== 'thinking' && state !== 'error';
    smileMat.opacity += ((smiling ? 1 : 0) - smileMat.opacity) * mouthK;
    thinkMat.opacity += ((!speaking && state === 'thinking' ? 1 : 0) - thinkMat.opacity) * mouthK;
    worriedMat.opacity += ((!speaking && state === 'error' ? 1 : 0) - worriedMat.opacity) * mouthK;
    const speechWeight = openMat.opacity;
    const armBeat = state === 'speaking' ? speechWeight : 0;
    head.rotation.x += Math.sin(t * 5) * 0.026 * speechWeight;
    const rightBeat = (0.5 + 0.5 * Math.sin(t * 3.4)) ** 3;
    const leftBeat = (0.5 + 0.5 * Math.sin(t * 2.6 + 1.4)) ** 3;
    joints.rElbow.object.rotation.x -= rightBeat * 0.19 * armBeat;
    joints.lElbow.object.rotation.x -= leftBeat * 0.12 * armBeat;
    root.position.x = state === 'error' ? Math.sin(stateTime * 26) * 0.009 * Math.exp(-stateTime * 2) : 0;

    if (blinkStart === null && t > blinkAt) blinkStart = t;
    let eyeScale = 1;
    if (blinkStart !== null) {
      const progress = (t - blinkStart) / blinkLength;
      if (progress >= 1) {
        blinkStart = null;
        blinkAt = t + 2.4 + (1 + Math.sin(t * 2.17)) * 1.5;
      } else {
        eyeScale = 1 - 0.94 * Math.sin(progress * Math.PI);
      }
    }
    for (let i = 0; i < eyes.length; i++) {
      eyes[i].scale.y = eyeScale;
      eyes[i].visible = eyeScale > 0.32;
      lids[i].visible = !eyes[i].visible;
    }
  }

  return {
    root,
    parts: { head, mouth, eyes },
    update,
    setState,
    setPointer,
    setTalking: enabled => { talkOverride = enabled == null ? null : Boolean(enabled); },
    get isTalking() { return isTalking(); },
    get hasPointer() { return pointer.visible; },
    get state() { return state; },
    blink: () => { if (blinkStart === null) blinkStart = lastTime - blinkLength * 0.37; },
  };
}
