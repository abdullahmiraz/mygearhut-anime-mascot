import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// MyGearHut brand accent. Kept in one place so a rebrand is a one-line change.
export const ACCENT = 0x22c55e;

const C = {
  skin: 0xd39a70,
  skinDark: 0xbd835d,
  hair: 0x4a352b,
  hairLight: 0x5b4232,
  brow: 0x3a2b23,
  eyeWhite: 0xf7f8f6,
  iris: 0x27313a,
  mouth: 0x6b3a30,
  blush: 0xe08a6a,
  shirt: ACCENT,
  shirtDark: 0x16833f,
  shirtDeep: 0x0f5d2c,
  pants: 0x2a3440,
  shoe: 0xf1f3f4,
  shoeShade: 0xd7dde1,
  rubber: 0x202a33,
  lace: 0xf8fafb,
  glass: 0x78828c,
  lip: 0x9c5a4f,
};

const standard = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0, ...extra });

const smooth = (x) => {
  const v = THREE.MathUtils.clamp(x, 0, 1);
  return v * v * (3 - 2 * v);
};

const envelope = (p, fadeIn = 0.18, fadeOut = 0.22) => {
  if (p < fadeIn) return smooth(p / fadeIn);
  if (p > 1 - fadeOut) return smooth((1 - p) / fadeOut);
  return 1;
};

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// Procedural strand texture for the hair. Built only in the browser so the Node
// rig check stays DOM-free. This adds real hair detail without extra geometry.
function hairStrandTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * 256;
    ctx.strokeStyle = i % 2 ? '#a0a0a0' : '#606060';
    ctx.lineWidth = 0.6 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 12, 70, x - 10, 180, x + 6, 256);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

// A segment whose pivot is at its top and whose body hangs down the local -Y axis.
function segment({ radius, length, material, name }) {
  const group = new THREE.Group();
  group.name = name;
  const core = Math.max(0.001, length - 2 * radius);
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, core, 6, 18), material);
  mesh.position.y = -length / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

// One sculpted hair mass. A sphere cap is displaced with broad waves for clumps,
// a lifted front edge for a side part, and two soft dips for bangs. This kept a
// continuous silhouette; loose ribbons and clumps read as strips or blobs.
function createHair(head, material) {
  const geo = new THREE.SphereGeometry(0.257, 64, 40, 0, Math.PI * 2, 0, Math.PI * 0.35);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const r = Math.sqrt(x * x + y * y + z * z) || 1;
    const theta = Math.atan2(x, z);
    const phi = Math.acos(THREE.MathUtils.clamp(y / r, -1, 1));

    const waves = 0.5 + 0.5 * Math.sin(theta * 6 + phi * 1.4);
    const sweep = 0.5 + 0.5 * Math.sin(theta - phi * 0.6);
    const partGroove = Math.exp(-Math.pow((theta - 0.5) / 0.14, 2)) * (1 - THREE.MathUtils.smoothstep(phi, 0.25, 0.7));
    const lift = 0.008 + 0.02 * waves + 0.012 * sweep - 0.012 * partGroove;
    const scale = (r + lift) / r;
    x *= scale;
    y *= scale;
    z *= scale;

    const front = Math.max(0, z / 0.257);
    const edge = THREE.MathUtils.smoothstep(0.18 - y, 0, 0.13);
    const part = THREE.MathUtils.smoothstep(x, -0.14, 0.14);
    y += front * edge * part * 0.055;
    y -= front * edge * (
      0.04 * Math.exp(-Math.pow((x - 0.07) / 0.055, 2)) +
      0.02 * Math.exp(-Math.pow((x + 0.07) / 0.05, 2))
    );
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const hair = new THREE.Mesh(geo, material);
  hair.castShadow = true;
  head.add(hair);
}

function roundedRect(ctx, w, h, r) {
  const x = -w / 2;
  const y = -h / 2;
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  return ctx;
}

function makeGlasses() {
  const group = new THREE.Group();
  group.name = 'glasses';
  const frameMat = standard(C.glass, { roughness: 0.4, metalness: 0.15 });

  for (const side of [-1, 1]) {
    const shape = roundedRect(new THREE.Shape(), 0.11, 0.078, 0.025);
    shape.holes.push(roundedRect(new THREE.Path(), 0.094, 0.062, 0.018));
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.005,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.002,
      bevelSegments: 2,
      curveSegments: 10,
    });
    const frame = new THREE.Mesh(geo, frameMat);
    frame.position.set(side * 0.09, 0.042, 0.218);
    group.add(frame);

    const temple = new THREE.Mesh(new RoundedBoxGeometry(0.092, 0.008, 0.008, 2, 0.004), frameMat);
    temple.position.set(side * 0.185, 0.052, 0.194);
    temple.rotation.y = side * -0.28;
    group.add(temple);
  }

  const bridge = new THREE.Mesh(new RoundedBoxGeometry(0.052, 0.008, 0.008, 2, 0.004), frameMat);
  bridge.position.set(0, 0.052, 0.219);
  group.add(bridge);
  return group;
}

// A tapered finger section. LatheGeometry gives rounded tips and a gentle
// narrowing toward the knuckle instead of a uniform cylinder.
function fingerSection(length, baseRadius, tipRadius, material) {
  const points = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(baseRadius * 0.72, 0),
    new THREE.Vector2(baseRadius, -length * 0.16),
    new THREE.Vector2(baseRadius * 0.94, -length * 0.52),
    new THREE.Vector2(tipRadius * 1.06, -length * 0.86),
    new THREE.Vector2(tipRadius * 0.62, -length * 0.98),
    new THREE.Vector2(0.001, -length),
  ];
  return new THREE.Mesh(new THREE.LatheGeometry(points, 14), material);
}

function makeFinger(lengths, bases, tips, x, y, spread, material) {
  const root = new THREE.Group();
  root.position.set(x, y, 0);
  root.rotation.z = spread;
  const joints = [];
  let parent = root;
  lengths.forEach((len, i) => {
    const joint = new THREE.Group();
    if (i > 0) joint.position.y = -lengths[i - 1];
    const mesh = fingerSection(len, bases[i], tips[i], material);
    mesh.castShadow = true;
    joint.add(mesh);
    parent.add(joint);
    joints.push(joint);
    parent = joint;
  });
  return { root, joints };
}

function makeHand(side, skin, shirt) {
  const hand = new THREE.Group();
  hand.name = side > 0 ? 'handR' : 'handL';

  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 14), skin);
  palm.scale.set(0.86, 1.05, 0.62);
  palm.castShadow = true;
  hand.add(palm);

  const knuckles = new THREE.Mesh(new THREE.SphereGeometry(0.05, 18, 12), skin);
  knuckles.position.y = -0.034;
  knuckles.scale.set(0.94, 0.42, 0.62);
  knuckles.castShadow = true;
  hand.add(knuckles);

  const xs = side > 0 ? [-0.034, -0.012, 0.012, 0.034] : [0.034, 0.012, -0.012, -0.034];
  const sizes = [
    { l: [0.04, 0.03, 0.024], b: [0.012, 0.0105, 0.0095], t: [0.0098, 0.0088, 0.0078] },
    { l: [0.049, 0.038, 0.029], b: [0.0125, 0.011, 0.01], t: [0.0102, 0.0092, 0.0082] },
    { l: [0.054, 0.042, 0.031], b: [0.013, 0.0115, 0.0105], t: [0.0106, 0.0096, 0.0086] },
    { l: [0.05, 0.038, 0.029], b: [0.0125, 0.011, 0.01], t: [0.0102, 0.0092, 0.0082] },
  ];
  const fingers = [];
  sizes.forEach((s, i) => {
    const spread = Math.sign(xs[i]) * 0.09;
    const f = makeFinger(s.l, s.b, s.t, xs[i], -0.045, spread, skin);
    hand.add(f.root);
    fingers.push(f);
  });

  const mound = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), skin);
  mound.position.set(side * 0.035, -0.012, 0.012);
  mound.scale.set(1, 1.2, 0.8);
  mound.castShadow = true;
  hand.add(mound);

  const thumb = makeFinger(
    [0.042, 0.032],
    [0.017, 0.014],
    [0.014, 0.011],
    side * 0.045,
    -0.008,
    side * -0.85,
    skin,
  );
  thumb.root.rotation.x = -0.25;
  hand.add(thumb.root);
  fingers.push(thumb);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.067, 0.032, 18), shirt);
  cuff.position.y = 0.055;
  cuff.castShadow = true;
  hand.add(cuff);
  const cuffBand = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 8, 20), standard(C.shirtDark));
  cuffBand.rotation.x = Math.PI / 2;
  cuffBand.position.y = 0.041;
  hand.add(cuffBand);

  hand.userData.fingers = fingers;
  hand.userData.curl = [0.22, 0.18, 0.14, 0.1, 0.16];
  return hand;
}

function makeShoe(side, upperMat, shadeMat, soleMat, laceMat, shirtMat) {
  const foot = new THREE.Group();

  const rubber = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.035, 0.285, 4, 0.016), soleMat);
  rubber.position.set(0, -0.093, 0.06);
  rubber.castShadow = true;
  foot.add(rubber);

  const midsole = new THREE.Mesh(new RoundedBoxGeometry(0.165, 0.045, 0.29, 4, 0.02), upperMat);
  midsole.position.set(0, -0.062, 0.06);
  midsole.castShadow = true;
  foot.add(midsole);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.077, 22, 16), upperMat);
  body.position.set(0, -0.018, 0.072);
  body.scale.set(1, 0.85, 1.55);
  body.castShadow = true;
  foot.add(body);

  const heel = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.08, 0.095, 3, 0.03), upperMat);
  heel.position.set(0, -0.018, -0.022);
  heel.castShadow = true;
  foot.add(heel);

  const toeCap = new THREE.Mesh(new THREE.SphereGeometry(0.058, 18, 12), shadeMat);
  toeCap.position.set(0, -0.035, 0.16);
  toeCap.scale.set(1.15, 0.55, 0.75);
  foot.add(toeCap);

  const tongue = new THREE.Mesh(new RoundedBoxGeometry(0.058, 0.016, 0.095, 2, 0.007), shadeMat);
  tongue.position.set(0, 0.037, 0.015);
  tongue.rotation.x = -0.32;
  foot.add(tongue);

  for (let i = 0; i < 4; i++) {
    const lace = new THREE.Mesh(new THREE.CapsuleGeometry(0.0045, 0.052, 3, 8), laceMat);
    lace.position.set(0, 0.03 + i * 0.004, 0.055 - i * 0.024);
    lace.rotation.z = i % 2 === 0 ? 0.55 : -0.55;
    foot.add(lace);
  }

  const stripe = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 10), shirtMat);
  stripe.position.set(side * 0.074, -0.012, 0.07);
  stripe.scale.set(0.18, 0.5, 1.15);
  stripe.rotation.z = side * -0.2;
  foot.add(stripe);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.009, 8, 20), shadeMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.018, -0.012);
  foot.add(collar);
  return foot;
}

export function createMascot() {
  const root = new THREE.Group();
  root.name = 'mascotRoot';

  const skin = standard(C.skin);
  const skinDark = standard(C.skinDark);
  const strandTex = hairStrandTexture();
  const hairMat = new THREE.MeshPhysicalMaterial({
    color: C.hair, roughness: 0.58, metalness: 0, sheen: 0.45,
    sheenColor: new THREE.Color(C.hairLight), sheenRoughness: 0.7,
    bumpMap: strandTex, bumpScale: strandTex ? 0.012 : 0,
    side: THREE.DoubleSide,
  });
  const browMat = standard(C.brow, { roughness: 0.9 });
  const eyeWhiteMat = standard(C.eyeWhite, { roughness: 0.3 });
  const irisMat = standard(C.iris, { roughness: 0.25 });
  const shirt = standard(C.shirt, { roughness: 0.78 });
  const shirtDark = standard(C.shirtDark, { roughness: 0.8 });
  const shirtDeep = standard(C.shirtDeep, { roughness: 0.85 });
  const pants = standard(C.pants, { roughness: 0.85 });
  const shoeMat = standard(C.shoe, { roughness: 0.6 });
  const shoeShade = standard(C.shoeShade, { roughness: 0.65 });
  const soleMat = standard(C.rubber, { roughness: 0.9 });
  const laceMat = standard(C.lace, { roughness: 0.75 });

  const parts = {};
  const joints = {};
  const track = (name, obj, base = { x: 0, y: 0, z: 0 }) => {
    joints[name] = { obj, base, off: { x: 0, y: 0, z: 0 }, cur: { ...base } };
  };
  const setOff = (name, x = 0, y = 0, z = 0) => {
    const j = joints[name];
    if (!j) return;
    j.off.x = x;
    j.off.y = y;
    j.off.z = z;
  };

  // Hips and pelvis.
  const hips = new THREE.Group();
  hips.name = 'hips';
  hips.position.y = 0.98;
  root.add(hips);
  parts.hips = hips;

  const pelvis = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.22, 0.26, 4, 0.08), pants);
  pelvis.position.y = -0.02;
  pelvis.castShadow = true;
  hips.add(pelvis);

  // Torso built as a lathed hoodie shape: wider at the shoulders, eased at the waist.
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 0.08;
  hips.add(torso);
  parts.torso = torso;
  track('torso', torso);

  const torsoProfile = [
    new THREE.Vector2(0.001, -0.05),
    new THREE.Vector2(0.16, -0.035),
    new THREE.Vector2(0.198, 0.02),
    new THREE.Vector2(0.21, 0.14),
    new THREE.Vector2(0.221, 0.3),
    new THREE.Vector2(0.226, 0.43),
    new THREE.Vector2(0.212, 0.53),
    new THREE.Vector2(0.156, 0.59),
    new THREE.Vector2(0.001, 0.62),
  ];
  const torsoMesh = new THREE.Mesh(new THREE.LatheGeometry(torsoProfile, 40), shirt);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torso.add(torsoMesh);
  parts.torsoMesh = torsoMesh;

  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 10, 32), shirtDark);
  hem.rotation.x = Math.PI / 2;
  hem.position.y = -0.022;
  torso.add(hem);

  // Hood tucked behind the neck.
  const hoodOuter = new THREE.Mesh(new THREE.SphereGeometry(0.185, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), shirtDark);
  hoodOuter.position.set(0, 0.51, -0.14);
  hoodOuter.rotation.x = -0.22;
  hoodOuter.scale.set(0.95, 0.8, 0.55);
  hoodOuter.castShadow = true;
  torso.add(hoodOuter);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.028, 10, 28), shirtDark);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.55;
  collar.castShadow = true;
  torso.add(collar);

  // Drawstrings follow a slight curve instead of hanging as straight sticks.
  for (const side of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      v(side * 0.048, 0.55, 0.2),
      v(side * 0.052, 0.47, 0.23),
      v(side * 0.046, 0.39, 0.234),
      v(side * 0.04, 0.33, 0.233),
    ]);
    const cord = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.0055, 7, false), laceMat);
    cord.castShadow = true;
    torso.add(cord);
    const aglet = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, 0.016, 3, 8), shoeShade);
    aglet.position.set(side * 0.04, 0.317, 0.233);
    torso.add(aglet);
  }

  // Kangaroo pocket with a top seam and two short angled openings.
  const pocket = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), shirtDark);
  pocket.position.set(0, 0.135, 0.215);
  pocket.scale.set(1.3, 0.48, 0.13);
  torso.add(pocket);
  const pocketSeam = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.008, 0.008, 2, 0.003), shirtDeep);
  pocketSeam.position.set(0, 0.205, 0.234);
  torso.add(pocketSeam);
  for (const side of [-1, 1]) {
    const opening = new THREE.Mesh(new THREE.CapsuleGeometry(0.0035, 0.028, 3, 8), shirtDark);
    opening.position.set(side * 0.055, 0.175, 0.238);
    opening.rotation.z = side * 0.6;
    torso.add(opening);
  }

  const badge = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.045, 0.012, 3, 0.011), shirtDeep);
  badge.position.set(0, 0.31, 0.232);
  torso.add(badge);
  const badgeDot = new THREE.Mesh(new THREE.SphereGeometry(0.01, 12, 10), soleMat);
  badgeDot.position.set(0, 0.31, 0.244);
  torso.add(badgeDot);

  // Neck rises out of the collar, with the head above it.
  const neck = new THREE.Group();
  neck.name = 'neck';
  neck.position.y = 0.58;
  torso.add(neck);
  parts.neck = neck;
  track('neck', neck);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.078, 0.19, 20), skin);
  neckMesh.position.y = 0.075;
  neckMesh.castShadow = true;
  neckMesh.receiveShadow = true;
  neck.add(neckMesh);

  const head = new THREE.Group();
  head.name = 'head';
  head.position.y = 0.36;
  neck.add(head);
  parts.head = head;
  track('head', head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.235, 40, 28), skin);
  skull.scale.set(1, 1.06, 0.93);
  skull.castShadow = true;
  skull.receiveShadow = true;
  head.add(skull);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.048, 18, 14), skinDark);
    ear.position.set(side * 0.232, -0.015, -0.005);
    ear.scale.set(0.45, 0.8, 0.5);
    ear.castShadow = true;
    head.add(ear);
  }

  createHair(head, hairMat);

  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.09, 0.042, 0.211);
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.033, 24, 16), eyeWhiteMat);
    white.scale.set(1.05, 0.85, 0.5);
    eye.add(white);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.019, 20, 14), irisMat);
    iris.position.set(0, 0, 0.016);
    iris.scale.set(1, 1, 0.5);
    eye.add(iris);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.005, 12, 10), eyeWhiteMat);
    glint.position.set(-0.006, 0.007, 0.027);
    eye.add(glint);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.035, 20, 12), skin);
    lid.position.set(0, 0.026, 0.004);
    lid.scale.set(1.05, 0.42, 0.55);
    eye.add(lid);
    head.add(eye);
    eyes.push(eye);

    const brow = new THREE.Mesh(new RoundedBoxGeometry(0.072, 0.011, 0.011, 2, 0.005), browMat);
    brow.position.set(side * 0.09, 0.102, 0.211);
    brow.rotation.z = side * 0.08;
    head.add(brow);

    const blush = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 16, 12),
      new THREE.MeshBasicMaterial({ color: C.blush, transparent: true, opacity: 0.12, depthWrite: false }),
    );
    blush.position.set(side * 0.16, -0.055, 0.19);
    blush.scale.set(1, 0.55, 0.2);
    head.add(blush);
  }
  parts.eyes = eyes;

  // Nose built from a bridge and tip so it reads as a face, not a ball.
  const noseBridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.045, 4, 12), skin);
  noseBridge.position.set(0, 0.018, 0.221);
  noseBridge.rotation.x = -0.16;
  noseBridge.castShadow = true;
  head.add(noseBridge);
  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.021, 18, 12), skin);
  noseTip.position.set(0, -0.026, 0.233);
  noseTip.scale.set(1.12, 0.85, 1);
  noseTip.castShadow = true;
  head.add(noseTip);
  for (const side of [-1, 1]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 10, 8), skinDark);
    nostril.position.set(side * 0.012, -0.038, 0.225);
    head.add(nostril);
  }

  const lipMat = standard(C.lip, { roughness: 0.65, transparent: true, opacity: 0.75 });
  const upperLip = new THREE.Mesh(new THREE.SphereGeometry(0.042, 18, 12), lipMat);
  upperLip.position.set(0, -0.07, 0.209);
  upperLip.scale.set(1.15, 0.13, 0.28);
  head.add(upperLip);
  const lowerLip = new THREE.Mesh(new THREE.SphereGeometry(0.041, 18, 12), lipMat);
  lowerLip.position.set(0, -0.092, 0.211);
  lowerLip.scale.set(1.1, 0.17, 0.28);
  head.add(lowerLip);

  const smileMat = standard(C.mouth, { roughness: 0.85, transparent: true, opacity: 1 });
  const openMat = standard(C.mouth, { roughness: 0.85, transparent: true, opacity: 0 });
  const mouth = new THREE.Group();
  mouth.name = 'mouth';
  mouth.position.set(0, -0.082, 0.228);
  head.add(mouth);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.005, 8, 28, Math.PI * 0.88), smileMat);
  smile.rotation.z = Math.PI * 1.06;
  mouth.add(smile);
  const openMouth = new THREE.Mesh(new THREE.SphereGeometry(0.04, 20, 14), openMat);
  openMouth.scale.set(1.1, 0.01, 0.3);
  mouth.add(openMouth);
  parts.mouth = mouth;
  parts.smile = smile;
  parts.openMouth = openMouth;

  head.add(makeGlasses());

  // Arms and hands.
  for (const side of [-1, 1]) {
    const label = side > 0 ? 'r' : 'l';
    const shoulderPos = new THREE.Vector3(side * 0.225, 0.47, 0);
    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.068, 20, 14), shirt);
    shoulderCap.position.copy(shoulderPos);
    shoulderCap.castShadow = true;
    torso.add(shoulderCap);

    const shoulder = segment({ radius: 0.068, length: 0.33, material: shirt, name: `${label}Shoulder` });
    shoulder.position.copy(shoulderPos);
    shoulder.rotation.z = side * 0.1;
    torso.add(shoulder);
    parts[`${label}Shoulder`] = shoulder;
    track(`${label}Shoulder`, shoulder, { x: 0.02, y: 0, z: side * 0.1 });

    const elbow = segment({ radius: 0.063, length: 0.31, material: shirt, name: `${label}Elbow` });
    elbow.position.y = -0.33;
    elbow.rotation.x = 0.06;
    shoulder.add(elbow);
    parts[`${label}Elbow`] = elbow;
    track(`${label}Elbow`, elbow, { x: 0.06, y: 0, z: 0 });

    const elbowCap = new THREE.Mesh(new THREE.SphereGeometry(0.063, 18, 12), shirt);
    elbowCap.castShadow = true;
    elbow.add(elbowCap);

    const hand = makeHand(side, skin, shirt);
    hand.position.y = -0.31;
    elbow.add(hand);
    parts[`${label}Hand`] = hand;
    track(`${label}Hand`, hand);
  }

  // Legs and shoes.
  for (const side of [-1, 1]) {
    const label = side > 0 ? 'r' : 'l';
    const hip = segment({ radius: 0.08, length: 0.44, material: pants, name: `${label}Hip` });
    hip.position.set(side * 0.14, -0.04, 0);
    hip.rotation.z = side * 0.02;
    hips.add(hip);
    parts[`${label}Hip`] = hip;
    track(`${label}Hip`, hip, { x: 0, y: 0, z: side * 0.02 });

    const knee = segment({ radius: 0.08, length: 0.4, material: pants, name: `${label}Knee` });
    knee.position.y = -0.44;
    hip.add(knee);
    parts[`${label}Knee`] = knee;
    track(`${label}Knee`, knee);

    const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 18, 12), pants);
    kneeCap.castShadow = true;
    knee.add(kneeCap);

    const foot = makeShoe(side, shoeMat, shoeShade, soleMat, laceMat, shirt);
    foot.position.y = -0.4;
    knee.add(foot);
    parts[`${label}Foot`] = foot;
  }

  // ---- Animation state ----
  const BASE_CURL = [0.22, 0.18, 0.14, 0.1, 0.16];
  const fingerTargets = [...BASE_CURL];
  let gesture = null;
  let talking = false;
  let talkAmp = 0.7;
  let nextBlink = 2.5;
  let blinkStart = -1;
  let lastT = 0;
  const BLINK_TIME = 0.14;

  function playGesture(name, duration) {
    const durations = { wave: 1.9, present: 1.7, point: 1.6, shrug: 1.5, nod: 1.3, think: 1.8 };
    if (!durations[name]) return false;
    gesture = { name, t: 0, duration: duration || durations[name] };
    return true;
  }

  function clearGesture() {
    gesture = null;
    for (const name of Object.keys(joints)) setOff(name);
    fingerTargets.splice(0, 5, ...BASE_CURL);
  }

  function applyGesture(p) {
    const e = envelope(p);
    const s = (name, x, y, z) => setOff(name, x * e, y * e, z * e);
    const { name } = gesture;
    if (name === 'wave') {
      s('rShoulder', -0.12, 0, 2.45);
      s('rElbow', -0.55, 0, 0);
      setOff('rHand', 0, 0, Math.sin(p * Math.PI * 7) * 0.5 * e);
      s('head', 0, 0, -0.05);
      fingerTargets.splice(0, 5, 0.3, 0.28, 0.25, 0.22, 0.15);
    } else if (name === 'present') {
      s('rShoulder', -0.25, 0, 1.7);
      s('lShoulder', -0.25, 0, -1.7);
      s('rElbow', -0.35, 0, 0);
      s('lElbow', -0.35, 0, 0);
      s('rHand', 0, 0, 0.5);
      s('lHand', 0, 0, -0.5);
      s('torso', -0.04, 0, 0);
      fingerTargets.splice(0, 5, 0.05, 0.04, 0.04, 0.04, 0.05);
    } else if (name === 'point') {
      s('rShoulder', -1.35, 0, 0.08);
      s('rElbow', 0.05, 0, 0);
      s('rHand', -1.5, 0, 0);
      s('head', 0.03, 0, 0);
      fingerTargets.splice(0, 5, 0.85, 0.85, 0.8, 0.0, 0.45);
    } else if (name === 'shrug') {
      s('rShoulder', -0.3, 0, 0.62);
      s('lShoulder', -0.3, 0, -0.62);
      s('rElbow', -1.55, 0, 0);
      s('lElbow', -1.55, 0, 0);
      s('rHand', 0, 0, 0.35);
      s('lHand', 0, 0, -0.35);
      s('head', 0, 0, 0.09);
      s('torso', 0, 0.05, 0);
      fingerTargets.splice(0, 5, 0.5, 0.5, 0.5, 0.45, 0.3);
    } else if (name === 'nod') {
      setOff('head', Math.sin(p * Math.PI * 4) * 0.16 * e, 0, 0);
      s('torso', 0.02, 0, 0);
      fingerTargets.splice(0, 5, ...BASE_CURL);
    } else if (name === 'think') {
      s('rShoulder', -0.9, 0, 0.5);
      s('rElbow', -1.9, 0, 0);
      s('rHand', 0, 0, 0.3);
      s('head', 0.02, -0.12, 0.1);
      fingerTargets.splice(0, 5, 0.45, 0.5, 0.55, 0.3, 0.2);
    }
  }

  function update(dt, t) {
    dt = Math.min(dt, 0.05);
    lastT = t;

    if (gesture) {
      gesture.t += dt;
      const p = gesture.t / gesture.duration;
      if (p >= 1) clearGesture();
      else applyGesture(p);
    }

    const idle = {
      torso: { x: 0, y: Math.sin(t * 0.42) * 0.012, z: Math.sin(t * 0.8) * 0.01 },
      neck: { x: Math.sin(t * 0.7) * 0.015, y: 0, z: 0 },
      head: {
        x: Math.sin(t * 0.7 + 0.6) * 0.025,
        y: Math.sin(t * 0.45) * 0.075,
        z: Math.sin(t * 0.33) * 0.018,
      },
      rShoulder: { x: 0, y: 0, z: Math.sin(t * 0.9) * 0.025 },
      lShoulder: { x: 0, y: 0, z: -Math.sin(t * 0.9) * 0.025 },
      rElbow: { x: Math.sin(t * 0.9 + 1) * 0.035, y: 0, z: 0 },
      lElbow: { x: Math.sin(t * 0.9 + 1.6) * 0.035, y: 0, z: 0 },
    };
    if (talking) idle.head.x += Math.sin(t * 5.2) * 0.01;

    const k = 1 - Math.exp(-dt * 12);
    for (const name of Object.keys(joints)) {
      const j = joints[name];
      const i = idle[name] || { x: 0, y: 0, z: 0 };
      const tx = j.base.x + j.off.x + i.x;
      const ty = j.base.y + j.off.y + i.y;
      const tz = j.base.z + j.off.z + i.z;
      j.cur.x += (tx - j.cur.x) * k;
      j.cur.y += (ty - j.cur.y) * k;
      j.cur.z += (tz - j.cur.z) * k;
      j.obj.rotation.set(j.cur.x, j.cur.y, j.cur.z);
    }

    const curlAmounts = [-0.42, -0.58, -0.34];
    for (const label of ['r', 'l']) {
      const hand = parts[`${label}Hand`];
      const fingers = hand.userData.fingers;
      for (let f = 0; f < fingers.length; f++) {
        const micro = gesture ? 0 : Math.sin(t * 1.3 + f * 0.8) * 0.02;
        const target = THREE.MathUtils.clamp(fingerTargets[f] + micro, 0, 1);
        hand.userData.curl[f] += (target - hand.userData.curl[f]) * k;
        const c = hand.userData.curl[f];
        fingers[f].joints.forEach((joint, i) => { joint.rotation.x = curlAmounts[i] * c; });
      }
    }

    root.position.y = Math.sin(t * 1.5) * 0.006;
    torsoMesh.scale.y = 1 + Math.sin(t * 1.7) * 0.007;

    // Talking mouth. Two frequencies avoid a mechanical, single-sine flap.
    let open = 0;
    if (talking) {
      const wave = Math.abs(Math.sin(t * 12.3)) * 0.68 + Math.abs(Math.sin(t * 7.1)) * 0.32;
      open = 0.2 + wave * 1.0 * talkAmp;
    }
    const mouthK = 1 - Math.exp(-dt * 20);
    openMouth.scale.y += (Math.max(0.01, open) - openMouth.scale.y) * mouthK;
    openMat.opacity += ((talking ? 1 : 0) - openMat.opacity) * mouthK;
    smileMat.opacity += ((talking ? 0 : 1) - smileMat.opacity) * mouthK;
    mouth.position.y = -0.082 - openMouth.scale.y * 0.008;

    // Blink on an irregular schedule.
    if (blinkStart < 0 && t > nextBlink) blinkStart = t;
    let eyeScale = 1;
    if (blinkStart >= 0) {
      const bp = (t - blinkStart) / BLINK_TIME;
      if (bp >= 1) {
        blinkStart = -1;
        nextBlink = t + 2.2 + Math.random() * 3.2;
      } else {
        eyeScale = 1 - 0.9 * Math.sin(bp * Math.PI);
      }
    }
    for (const eye of eyes) eye.scale.y = eyeScale;
  }

  return {
    root,
    parts,
    update,
    playGesture,
    clearGesture,
    setTalking: (val) => { talking = !!val; },
    setTalkAmplitude: (val) => { talkAmp = THREE.MathUtils.clamp(val, 0, 1); },
    blink: () => { if (blinkStart < 0) blinkStart = lastT - BLINK_TIME * 0.5; }, // ponytail: forces one blink; upgrade to an explicit blink queue if timing must be scripted
    get currentGesture() { return gesture ? gesture.name : null; },
    get isTalking() { return talking; },
  };
}
