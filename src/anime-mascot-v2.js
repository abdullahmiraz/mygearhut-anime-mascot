import * as THREE from 'three';
import {
  ACCENT, COLORS, toon, flat, part, oval, profileGeometry, limb, HEAD, faceDepth,
  headGeometry, hairGeometry, facePatch, ellipse, makeEye, makeBrow, makeHand,
  makePointer, makeSneaker, POSES, REST,
} from './anime-mascot.js';

// Animation principles behind this version:
// - Every joint is a damped spring, so motion accelerates, overshoots a little
//   and settles instead of easing linearly.
// - Joints start at different times (torso, then arms, then head, then brows) so
//   a pose change reads as one overlapping movement instead of a snap.
// - The hair, hands and forearms carry their own softer springs and lag behind
//   the head and shoulders, which gives follow-through.
// - Blink, gaze and idle drift are deterministic, so a recorded take repeats.

const SPRINGS = {
  torso: [3.6, 0.9],
  head: [3.9, 0.82],
  browL: [11, 0.9],
  browR: [11, 0.9],
  rShoulder: [3.8, 0.72],
  lShoulder: [3.8, 0.72],
  rElbow: [4.4, 0.68],
  lElbow: [4.4, 0.68],
};

// Seconds to hold the previous pose per joint when the state changes.
const DELAYS = {
  torso: 0,
  rShoulder: 0.03,
  lShoulder: 0.03,
  rElbow: 0.055,
  lElbow: 0.055,
  head: 0.085,
  browL: 0.12,
  browR: 0.12,
};

const GESTURES = {
  waving: 3.1,
  nodding: 1.5,
  celebrating: 2.5,
  presenting: 3.0,
  comparing: 3.3,
  thinking: 3.0,
  'point-left': 2.8,
  'point-right': 2.8,
  error: 2.4,
  speaking: 3.0,
};

const BLINK = 0.18;
const REST_VECTOR = new THREE.Vector3();

const smooth = (value, min, max) => THREE.MathUtils.smoothstep(value, min, max);
const clamp = (value, min, max) => THREE.MathUtils.clamp(value, min, max);
const damp = (value, target, lambda, dt) => THREE.MathUtils.damp(value, target, lambda, dt);
const hash = (n) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

// Analytic damped harmonic oscillator. Unlike an Euler step it stays stable at
// any frame rate without substepping, and still keeps its velocity.
function springStep(value, velocity, target, dt, frequency, damping) {
  const w = Math.PI * 2 * frequency;
  const z = clamp(damping, 0.08, 0.98);
  const wd = w * Math.sqrt(1 - z * z);
  const decay = Math.exp(-z * w * dt);
  const offset = value - target;
  const cos = Math.cos(wd * dt);
  const sin = Math.sin(wd * dt);
  const next = target + decay * (offset * cos + ((velocity + z * w * offset) / wd) * sin);
  const nextVelocity = -z * w * (next - target)
    + decay * (-offset * wd * sin + (velocity + z * w * offset) * cos);
  return [next, nextVelocity];
}

function poseVector(pose, name) {
  const target = pose[name] ?? REST;
  const [x, y, z] = Array.isArray(target) ? target : [0, 0, target];
  return new THREE.Vector3(x, y, z);
}

export function createAnimeMascotV2() {
  const root = new THREE.Group();
  root.name = 'animeRootV2';
  const skin = toon(COLORS.skin);
  const trim = toon(COLORS.trim);
  const shirt = toon(ACCENT);
  const pants = toon(COLORS.pants);
  const shoes = { trim, shoe: toon(COLORS.shoe), rubber: toon(COLORS.rubber), outsole: toon(COLORS.outsole) };
  const joints = {};
  const handRigs = {};
  const pointer = makePointer();
  const feet = {};
  let talking = false;
  let amplitude = 1;

  const track = (name, object, base = REST) => {
    object.name = name;
    const [frequency, damping] = SPRINGS[name] ?? [11, 0.85];
    joints[name] = {
      object,
      base,
      pose: new THREE.Vector3(),
      pending: null,
      delay: DELAYS[name] ?? 0.04,
      delayAt: 0,
      value: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      frequency,
      damping,
    };
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

  // The hair hangs from a pivot above the crown, so head motion can drag it a
  // few degrees behind the skull.
  const hairPivot = new THREE.Group();
  hairPivot.name = 'hairPivot';
  hairPivot.position.set(0, 0.235, 0);
  head.add(hairPivot);
  const hair = part(hairPivot, hairGeometry(), toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
  hair.name = 'hair';
  hair.position.y = -0.235;

  const face = new THREE.Group();
  head.add(face);
  const ear = toon(COLORS.ear);
  const eyes = [];
  const lids = [];
  const gazeGroups = [];
  for (const side of [-1, 1]) {
    oval(head, 0.043, 0.058, 0.035, skin, {
      pos: [side * 0.267, -0.024, 0.029], rot: [0, side * 0.32, side * 0.2], ink: 0.035,
    });
    oval(head, 0.018, 0.034, 0.008, ear, {
      pos: [side * 0.277, -0.023, 0.06], rot: [0, side * 0.45, side * 0.25],
    });
    const { eye, lid, gaze } = makeEye(face, side);
    eyes.push(eye);
    lids.push(lid);
    gazeGroups.push(gaze);
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
  const smile = facePatch(mouth, smileShape, smileMat, 0, -0.127, 0.008);
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
    const rig = makeHand(elbow, skin, side, 0.252);
    rig.hand.name = label + 'Hand';
    handRigs[label] = { ...rig, value: new THREE.Vector3(), velocity: new THREE.Vector3() };

    const { lower: knee } = limb(hips, pants, [side * 0.095, -0.073, 0], 0.37, 0.09, 0.87, [
      [-0.665, 0], [-0.658, 0.057], [-0.545, 0.059], [-0.43, 0.065], [-0.372, 0.069],
      [-0.23, 0.077], [-0.075, 0.086], [0.038, 0.084], [0.083, 0],
    ]);
    feet[label] = makeSneaker(knee, shoes, side);
  }

  handRigs.r.hand.add(pointer);

  let state = 'idle';
  let stateTime = 0;
  let gestureReturn = null;
  let lastTime = 0;

  // Blink and gaze clocks are deterministic; a re-record matches the take.
  let blinkStart = null;
  let nextBlinkAt = 1.9;
  let blinkCount = 0;
  let gazeX = 0;
  let gazeY = 0;
  let gazeTargetX = 0;
  let gazeTargetY = 0;
  let gazeSeed = 0;
  let nextGazeAt = 1.1;
  let gazeHold = false;
  let gazeVelocityX = 0;
  let gazeVelocityY = 0;

  const hairValue = new THREE.Vector3();
  const hairVelocity = new THREE.Vector3();
  const prevHead = new THREE.Vector3();
  const extra = {};
  for (const name of Object.keys(joints)) extra[name] = new THREE.Vector3();

  const applyJoints = () => {
    for (const joint of Object.values(joints)) {
      joint.object.rotation.set(
        joint.base[0] + joint.value.x,
        joint.base[1] + joint.value.y,
        joint.base[2] + joint.value.z,
      );
    }
  };

  const snapJoints = () => {
    for (const joint of Object.values(joints)) {
      joint.pose.copy(poseVector(POSES[state], joint.object.name));
      joint.pending = null;
      joint.value.copy(joint.pose);
      joint.velocity.set(0, 0, 0);
    }
    applyJoints();
    prevHead.copy(head.rotation);
  };
  snapJoints();

  const idleCurl = POSES.idle.curl;
  for (const rig of Object.values(handRigs)) {
    rig.fingers.forEach((finger, i) => {
      finger.rotation.x = -idleCurl * (0.8 + i * 0.07);
    });
  }
  smileMat.opacity = 1;
  openMouth.scale.y = 0.02;
  openMouth.scale.x = 1;

  function mountPointer() {
    const side = POSES[state].point ?? (state === 'thinking' ? 'l' : 'r');
    handRigs[side].hand.add(pointer);
  }

  function setState(name, { force = false } = {}) {
    if (!Object.hasOwn(POSES, name)) return false;
    if (state !== name || force) {
      state = name;
      stateTime = 0;
      for (const joint of Object.values(joints)) {
        joint.pending = poseVector(POSES[name], joint.object.name);
        joint.delayAt = joint.delay;
      }
    }
    mountPointer();
    return true;
  }

  function playGesture(name, hold) {
    if (!Object.hasOwn(POSES, name)) return false;
    const previous = state;
    setState(name, { force: true });
    gestureReturn = { at: hold ?? GESTURES[name] ?? 2.4, state: previous };
    return true;
  }

  function update(dt, t) {
    dt = clamp(dt, 0, 0.05);
    lastTime = t;
    stateTime += dt;
    const pose = POSES[state];
    const speaking = talking || state === 'speaking';

    if (gestureReturn && stateTime >= gestureReturn.at) {
      const back = gestureReturn.state;
      gestureReturn = null;
      setState(back, { force: true });
    }

    for (const joint of Object.values(joints)) {
      if (joint.pending && stateTime >= joint.delayAt) {
        joint.pose.copy(joint.pending);
        joint.pending = null;
      }
    }

    // --- Layered motion on top of the pose -------------------------------
    for (const vector of Object.values(extra)) vector.set(0, 0, 0);
    const breath = Math.sin(t * 1.9);
    const sway = Math.sin(t * 0.43);
    const drift = Math.sin(t * 0.61 + 1.2);
    const speechWeight = openMat.opacity;

    torso.position.y = 0.045 + breath * 0.0032;
    head.position.y = 0.341 + breath * 0.0011;

    extra.torso.z += 0.014 * sway;
    extra.torso.x += speaking ? 0.01 * Math.sin(t * 1.25) : 0;
    extra.head.x += 0.006 * drift;
    extra.head.z -= 0.01 * sway;
    extra.rShoulder.z += breath * 0.004;
    extra.lShoulder.z -= breath * 0.004;
    extra.rElbow.x += -0.012 + 0.008 * Math.sin(t * 0.83);
    extra.lElbow.x += -0.012 + 0.008 * Math.sin(t * 0.71 + 1.4);

    if (state === 'waving') {
      const ramp = smooth(stateTime, 0, 0.4);
      const beat = Math.sin(stateTime * 10.8);
      extra.rElbow.x -= 0.13 * beat * ramp;
      extra.head.z += 0.05 * ramp;
      extra.head.y += 0.03 * ramp;
      extra.torso.z -= 0.018 * ramp;
    }

    if (state === 'nodding') {
      const pulse = (start, strength) => strength
        * Math.sin(Math.PI * clamp((stateTime - start) / 0.34, 0, 1)) ** 2;
      extra.head.x += pulse(0.06, 0.2) + pulse(0.42, 0.13);
      extra.torso.x += pulse(0.1, 0.045);
    }

    if (state === 'celebrating') {
      const ramp = smooth(stateTime, 0, 0.32);
      const pump = Math.sin(stateTime * 10.5) * Math.exp(-stateTime * 1.15);
      extra.rElbow.z += 0.24 * pump * ramp;
      extra.lElbow.z -= 0.24 * pump * ramp;
      extra.torso.x -= 0.035 * pump * ramp;
      extra.head.x -= 0.02 * pump * ramp;
    }

    if (state === 'comparing') {
      const ramp = Math.min(1, stateTime * 4);
      const shift = Math.sin(stateTime * 2.4) * 0.1 * ramp;
      extra.head.y += shift;
      extra.head.z += shift * 0.2;
      extra.rElbow.x += shift * 0.7;
      extra.lElbow.x -= shift * 0.7;
    }

    if (state === 'point-left' || state === 'point-right') {
      const ramp = smooth(stateTime, 0.1, 0.7);
      extra.head.y += (state === 'point-right' ? 0.012 : -0.012) * Math.sin(stateTime * 1.7) * ramp;
    }

    const rightBeat = (0.5 + 0.5 * Math.sin(t * 3.2)) ** 3;
    const leftBeat = (0.5 + 0.5 * Math.sin(t * 2.5 + 1.4)) ** 3;
    const armBeat = speaking ? speechWeight : 0;
    extra.rElbow.x -= rightBeat * 0.2 * armBeat;
    extra.lElbow.x -= leftBeat * 0.12 * armBeat;
    extra.head.x += 0.02 * Math.sin(t * 4.9) * speechWeight;

    // --- Springs ---------------------------------------------------------
    for (const [name, joint] of Object.entries(joints)) {
      const target = joint.pose.clone().add(extra[name]);
      const [fx, vx] = springStep(joint.value.x, joint.velocity.x, target.x, dt, joint.frequency, joint.damping);
      const [fy, vy] = springStep(joint.value.y, joint.velocity.y, target.y, dt, joint.frequency, joint.damping);
      const [fz, vz] = springStep(joint.value.z, joint.velocity.z, target.z, dt, joint.frequency, joint.damping);
      joint.value.set(fx, fy, fz);
      joint.velocity.set(vx, vy, vz);
    }
    applyJoints();

    // --- Arms and hands --------------------------------------------------
    const wave = state === 'waving'
      ? Math.sin(stateTime * 10.8 - 0.45) * 0.32 * smooth(stateTime, 0, 0.4)
      : 0;
    for (const [side, rig] of Object.entries(handRigs)) {
      const [x, y, z] = pose[rig.hand.name] ?? REST;
      const gripping = pointer.visible && pointer.parent === rig.hand;
      const driftX = 0.008 * Math.sin(t * 0.9 + (side === 'r' ? 0 : 1.7));
      const targetX = (gripping ? 0 : x) + driftX;
      const targetY = gripping ? y * 0.3 : y;
      const targetZ = z + (side === 'r' ? wave : 0);
      const [hx, hvx] = springStep(rig.value.x, rig.velocity.x, targetX, dt, 5.4, 0.65);
      const [hy, hvy] = springStep(rig.value.y, rig.velocity.y, targetY, dt, 5.4, 0.65);
      const [hz, hvz] = springStep(rig.value.z, rig.velocity.z, targetZ, dt, 5.4, 0.65);
      rig.value.set(hx, hy, hz);
      rig.velocity.set(hvx, hvy, hvz);
      rig.hand.rotation.set(hx, hy, hz);

      const pointing = pose.point === side;
      const curl = side === 'l'
        ? (pose.leftCurl ?? (state === 'waving' ? idleCurl : pose.curl))
        : pose.curl;
      rig.fingers.forEach((finger, i) => {
        const bend = gripping ? 1.6 : pointing ? (i === 0 ? 0.04 : 1.65) : curl;
        const rate = 1 - Math.exp(-dt * (16 + i * 2));
        finger.rotation.x += (-bend * (0.8 + i * 0.07) - finger.rotation.x) * rate;
      });
    }
    const pointerTarget = pose.point ? 0 : pointer.parent === handRigs.r.hand ? 0.09 : -0.09;
    pointer.rotation.z = damp(pointer.rotation.z, pointerTarget, 12, dt);

    // --- Face ------------------------------------------------------------
    const beat = 0.5 + 0.5 * Math.sin(t * 8.6 + 0.9 * Math.sin(t * 2.7));
    const phrase = 0.62 + 0.38 * Math.sin(t * 1.13 + 0.6);
    const openness = speaking
      ? (0.1 + 0.82 * beat ** 1.7) * (0.78 + 0.22 * phrase) * amplitude
      : 0.02;
    const mouthK = 1 - Math.exp(-dt * 20);
    openMouth.scale.y += (Math.max(0.02, openness) - openMouth.scale.y) * mouthK;
    openMouth.scale.x += ((speaking ? 1 - 0.08 * beat : 1) - openMouth.scale.x) * mouthK;
    openMat.opacity += ((speaking ? 1 : 0) - openMat.opacity) * mouthK;
    teethMat.opacity = openMat.opacity * smooth(openMouth.scale.y, 0.26, 0.62);
    tongueMat.opacity = openMat.opacity;

    // A little smile stays while talking so the character does not go blank.
    const smileTarget = speaking ? 0.18 : (state === 'thinking' || state === 'error') ? 0 : 1;
    smileMat.opacity += (smileTarget - smileMat.opacity) * mouthK;
    const smileScale = state === 'celebrating' ? 1.06 : 1;
    smile.scale.x += (smileScale - smile.scale.x) * mouthK;
    thinkMat.opacity += ((!speaking && state === 'thinking' ? 1 : 0) - thinkMat.opacity) * mouthK;
    worriedMat.opacity += ((!speaking && state === 'error' ? 1 : 0) - worriedMat.opacity) * mouthK;

    // --- Blink -----------------------------------------------------------
    if (blinkStart === null && t >= nextBlinkAt) blinkStart = t;
    let eyeOpen = 1;
    if (blinkStart !== null) {
      const progress = (t - blinkStart) / BLINK;
      if (progress >= 1) {
        blinkStart = null;
        blinkCount++;
        const gap = 1.9 + hash(blinkCount * 2.3) * 3.1;
        nextBlinkAt = t + (hash(blinkCount * 5.7) > 0.78 ? 0.16 : gap);
      } else {
        const closing = smooth(progress, 0, 0.34);
        const opening = smooth(progress, 0.34, 1);
        eyeOpen = 1 - 0.97 * closing * (1 - opening);
      }
    }
    for (let i = 0; i < eyes.length; i++) {
      eyes[i].scale.y = eyeOpen;
      eyes[i].visible = eyeOpen > 0.42;
      lids[i].visible = !eyes[i].visible;
    }

    // --- Gaze ------------------------------------------------------------
    if (!gazeHold && t >= nextGazeAt) {
      gazeSeed++;
      const bias = state === 'thinking' ? [-0.0026, 0.0016]
        : state === 'waving' ? [0.0022, 0.0004]
          : state === 'error' ? [0, -0.0006] : [0, 0];
      gazeTargetX = bias[0] + (hash(gazeSeed * 1.7) - 0.5) * 0.005;
      gazeTargetY = bias[1] + (hash(gazeSeed * 4.1) - 0.5) * 0.0032;
      nextGazeAt = t + 1.2 + hash(gazeSeed * 3.3) * 2.3;
    }
    [gazeX, gazeVelocityX] = springStep(gazeX, gazeVelocityX, gazeTargetX, dt, 5, 0.95);
    [gazeY, gazeVelocityY] = springStep(gazeY, gazeVelocityY, gazeTargetY, dt, 5, 0.95);
    const tremble = state === 'error' ? Math.sin(t * 30) * 0.0006 : 0;
    for (const gaze of gazeGroups) gaze.position.set(gazeX + tremble, gazeY, 0);

    // --- Hair lag --------------------------------------------------------
    const headSpeedX = (head.rotation.x - prevHead.x) / Math.max(dt, 1e-4);
    const headSpeedZ = (head.rotation.z - prevHead.z) / Math.max(dt, 1e-4);
    const hairTargetX = clamp(headSpeedX * 0.03, -0.07, 0.07) + 0.002 * Math.sin(t * 1.05);
    const hairTargetZ = clamp(headSpeedZ * 0.03, -0.07, 0.07) + 0.004 * Math.sin(t * 1.4);
    [hairValue.x, hairVelocity.x] = springStep(hairValue.x, hairVelocity.x, hairTargetX, dt, 2.4, 0.4);
    [hairValue.z, hairVelocity.z] = springStep(hairValue.z, hairVelocity.z, hairTargetZ, dt, 2.4, 0.4);
    hairPivot.rotation.set(hairValue.x, 0, hairValue.z);
    prevHead.copy(head.rotation);

    // --- Grounding -------------------------------------------------------
    const shake = state === 'error' ? Math.sin(stateTime * 27) * 0.008 * Math.exp(-stateTime * 2.4) : 0;
    root.position.x = damp(root.position.x, shake, 14, dt);
    root.position.y = 0;
  }

  return {
    root,
    parts: {
      head, mouth, eyes, lids, hairPivot, pointer, feet, joints,
      hands: { r: handRigs.r.hand, l: handRigs.l.hand },
      openMouth, smile, upperTeeth, tongue, thinkingMouth, worriedMouth,
      gaze: gazeGroups,
    },
    update,
    setState: (name) => {
      const ok = setState(name);
      if (ok) gestureReturn = null;
      return ok;
    },
    playGesture,
    setTalking: (enabled) => { talking = Boolean(enabled); },
    setAmplitude: (value) => { if (Number.isFinite(value)) amplitude = clamp(value, 0, 1); },
    setPointer: (enabled) => { pointer.visible = Boolean(enabled); },
    blink: () => {
      if (blinkStart === null) blinkStart = lastTime - BLINK * 0.45;
    },
    gaze: (x, y) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      gazeHold = true;
      gazeTargetX = clamp(x, -0.006, 0.006);
      gazeTargetY = clamp(y, -0.0035, 0.0035);
      return true;
    },
    gazeAuto: () => { gazeHold = false; },
    get state() { return state; },
    get amplitude() { return amplitude; },
  };
}
