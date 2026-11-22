import { Vector3 } from 'three';
import { createAnimeMascotV2 } from '../src/anime-mascot-v2.js';

const fail = [];
const check = (label, value, min, max) => {
  if (!Number.isFinite(value) || value < min || value > max) fail.push(`${label}: ${value} not in [${min}, ${max}]`);
};

const rig = () => {
  const mascot = createAnimeMascotV2();
  mascot.time = 0;
  return mascot;
};
const advance = (mascot, frames, dt = 1 / 60) => {
  for (let i = 0; i < frames; i++) {
    mascot.time += dt;
    mascot.update(dt, mascot.time);
  }
  mascot.root.updateMatrixWorld(true);
};
const world = (object) => object.getWorldPosition(new Vector3());
const wristY = (mascot) => world(mascot.parts.hands.r).y;

// --- Pose transitions, springs and grounding -----------------------------
const m = rig();
if (m.setState('toString') || m.state !== 'idle') fail.push('v2 accepted an invalid state');
advance(m, 120);
check('v2 idle wrist height', wristY(m), 0.55, 0.75);
check('v2 root stays grounded', m.root.position.y, 0, 0);

const footL = world(m.parts.feet.l);
const footR = world(m.parts.feet.r);
m.setState('waving');
let peak = -Infinity;
let maxStep = 0;
let previous = m.parts.joints.rShoulder.value.z;
for (let i = 0; i < 90; i++) {
  m.time += 1 / 60;
  m.update(1 / 60, m.time);
  const z = m.parts.joints.rShoulder.value.z;
  peak = Math.max(peak, z);
  maxStep = Math.max(maxStep, Math.abs(z - previous));
  previous = z;
}
m.root.updateMatrixWorld(true);
check('v2 wave wrist height', wristY(m), 1.4, 1.7);
check('v2 arm travel is smooth', maxStep, 0.01, 0.55);
const settled = m.parts.joints.rShoulder.value.z;
check('v2 arm has overshoot', peak - settled, 0.015, 0.25);
check('v2 left foot stays planted', world(m.parts.feet.l).distanceTo(footL), 0, 1e-9);
check('v2 right foot stays planted', world(m.parts.feet.r).distanceTo(footR), 0, 1e-9);
check('v2 joints stay finite', m.parts.joints.head.value.length(), 0, 100);

m.setState('idle');
advance(m, 240);
const velocities = Object.values(m.parts.joints).map((j) => j.velocity.length());
check('v2 idle settles quietly', Math.max(...velocities), 0, 0.3);

// --- Gesture clips return to the previous state ---------------------------
const gestureRig = rig();
gestureRig.playGesture('waving', 0.6);
advance(gestureRig, 20);
if (gestureRig.state !== 'waving') fail.push('v2 gesture ended too early');
advance(gestureRig, 40);
if (gestureRig.state !== 'idle') fail.push(`v2 gesture did not settle back, ended in ${gestureRig.state}`);

// --- Blink ----------------------------------------------------------------
const blinker = rig();
blinker.blink();
advance(blinker, 1);
check('v2 blink closes the eye', blinker.parts.eyes[0].scale.y, 0.05, 0.45);
const closedLid = blinker.root.getObjectByName('lClosedLid');
if (!closedLid.visible || blinker.parts.eyes[0].visible) fail.push('v2 did not switch to the closed eyelid');
advance(blinker, 24);
check('v2 blink reopens', blinker.parts.eyes[0].scale.y, 0.9, 1);
if (closedLid.visible || !blinker.parts.eyes[0].visible) fail.push('v2 did not reopen the eye');

// --- Determinism ----------------------------------------------------------
const first = rig();
const second = rig();
for (let i = 0; i < 180; i++) {
  const t = (i + 1) / 60;
  first.update(1 / 60, t);
  second.update(1 / 60, t);
}
check('v2 animation is deterministic (joint)',
  Math.abs(first.parts.joints.head.value.x - second.parts.joints.head.value.x), 0, 1e-12);
check('v2 animation is deterministic (face)',
  Math.abs(first.parts.eyes[0].scale.y - second.parts.eyes[0].scale.y), 0, 1e-12);

// --- Gaze -----------------------------------------------------------------
const gazer = rig();
advance(gazer, 30);
if (!gazer.gaze(0.006, 0.003)) fail.push('v2 rejected a valid gaze target');
advance(gazer, 60);
check('v2 gaze moves the iris', gazer.parts.gaze[0].position.x, 0.004, 0.0065);
check('v2 gaze is mirrored', gazer.parts.gaze[1].position.x, 0.004, 0.0065);
if (gazer.gaze('a', 0.1)) fail.push('v2 accepted an invalid gaze target');
gazer.gazeAuto();

// --- Speech and expressions ----------------------------------------------
const loud = rig();
const quiet = rig();
loud.setTalking(true);
quiet.setTalking(true);
loud.setAmplitude(1);
quiet.setAmplitude(0.25);
let loudMax = 0;
let quietMax = 0;
for (let i = 0; i < 90; i++) {
  const t = (i + 1) / 60;
  loud.update(1 / 60, t);
  quiet.update(1 / 60, t);
  loudMax = Math.max(loudMax, loud.parts.openMouth.scale.y);
  quietMax = Math.max(quietMax, quiet.parts.openMouth.scale.y);
}
check('v2 speech opens the mouth', loudMax, 0.5, 1.2);
check('v2 amplitude scales the mouth', loudMax / quietMax, 1.8, 12);
check('v2 keeps a smile while talking', loud.parts.smile.material.opacity, 0.1, 0.3);
check('v2 talks with visible mouth', loud.parts.openMouth.material.opacity, 0.95, 1);

const thinker = rig();
thinker.setState('thinking');
advance(thinker, 90);
check('v2 thinking mouth', thinker.parts.thinkingMouth.material.opacity, 0.95, 1);
check('v2 thinking hides the smile', thinker.parts.smile.material.opacity, 0, 0.1);
const errored = rig();
errored.setState('error');
advance(errored, 90);
check('v2 worried mouth', errored.parts.worriedMouth.material.opacity, 0.95, 1);
check('v2 error hides thinking mouth', errored.parts.thinkingMouth.material.opacity, 0, 0.05);
check('v2 error keeps the character grounded', errored.root.position.y, 0, 0);

const idleFace = rig();
advance(idleFace, 90);
check('v2 idle smile', idleFace.parts.smile.material.opacity, 0.95, 1);
check('v2 idle mouth hidden', idleFace.parts.openMouth.material.opacity, 0, 0.05);

// --- Secondary motion: hair lags the head ---------------------------------
const headRig = rig();
advance(headRig, 30);
headRig.playGesture('nodding');
let headPeak = 0;
let hairPeak = 0;
for (let i = 0; i < 60; i++) {
  headRig.time += 1 / 60;
  headRig.update(1 / 60, headRig.time);
  headPeak = Math.max(headPeak, Math.abs(headRig.parts.joints.head.value.x));
  hairPeak = Math.max(hairPeak, Math.abs(headRig.parts.hairPivot.rotation.x));
}
check('v2 nod drives the head', headPeak, 0.12, 0.6);
check('v2 hair lags behind the head', hairPeak, 0.003, 0.08);
advance(headRig, 240);
check('v2 hair settles', Math.abs(headRig.parts.hairPivot.rotation.x), 0, 0.005);

// --- Pointer --------------------------------------------------------------
m.setPointer(true);
advance(m, 2);
if (!m.parts.pointer.visible || m.parts.pointer.parent !== m.parts.hands.r) fail.push('v2 pointer is not held in the right hand');
m.setPointer(false);
if (m.parts.pointer.visible) fail.push('v2 pointer did not hide');

if (fail.length) {
  console.error('V2 rig check FAILED\n' + fail.join('\n'));
  process.exit(1);
}
console.log('V2 rig check passed: spring transitions, overshoot, planted feet, gesture return, blink, gaze, speech, expressions and hair lag');
