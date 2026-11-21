import { Vector3 } from 'three';
import { createAnimeMascot } from '../src/anime-mascot.js';
import { createMascot } from '../src/mascot.js';

const mascot = createMascot();
const fail = [];
const check = (label, value, min, max) => {
  if (!Number.isFinite(value) || value < min || value > max) fail.push(`${label}: ${value.toFixed(3)} not in [${min}, ${max}]`);
};

mascot.playGesture('wave');
for (let i = 0; i < 60; i++) mascot.update(1 / 60, i / 60);
check('wave shoulder z', mascot.parts.rShoulder.rotation.z, 2.2, 2.7);
check('wave elbow x', mascot.parts.rElbow.rotation.x, -0.7, -0.3);

mascot.playGesture('point');
for (let i = 0; i < 60; i++) mascot.update(1 / 60, 1 + i / 60);
check('point shoulder x', mascot.parts.rShoulder.rotation.x, -1.5, -1.1);
check('point hand x', mascot.parts.rHand.rotation.x, -1.7, -1.3);
check('point index extended', mascot.parts.rHand.userData.curl[3], 0, 0.1);
check('point pinky folded', mascot.parts.rHand.userData.curl[0], 0.7, 1);

mascot.clearGesture();
mascot.setTalking(true);
for (let i = 0; i < 60; i++) mascot.update(1 / 60, 2 + i / 60);
check('talk mouth open', mascot.parts.openMouth.scale.y, 0.1, 1.5);
check('talk smile hidden', mascot.parts.smile.material.opacity, 0, 0.05);

mascot.setTalking(false);
for (let i = 0; i < 60; i++) mascot.update(1 / 60, 3 + i / 60);
check('idle mouth closed', mascot.parts.openMouth.scale.y, 0, 0.02);
check('idle smile visible', mascot.parts.smile.material.opacity, 0.95, 1);

const anime = createAnimeMascot();
const hair = anime.root.getObjectByName('hair').geometry;
const crown = hair.getAttribute('position');
for (let i = 1; i <= hair.parameters.widthSegments; i++) {
  check('anime crown shares one pole', Math.abs(crown.getY(i) - crown.getY(0)), 0, 0.00001);
}
const checkExpression = (name, min, max) => {
  check(name, anime.root.getObjectByName(name).material.opacity, min, max);
};
let animeTime = 0;
const advanceAnime = frames => {
  for (let i = 0; i < frames; i++) {
    animeTime += 1 / 60;
    anime.update(1 / 60, animeTime);
  }
  anime.root.updateMatrixWorld(true);
};
const handY = () => anime.root.getObjectByName('rHand').getWorldPosition(new Vector3()).y;

anime.setState('waving');
advanceAnime(60);
check('anime wave wrist height', handY(), 1.42, 1.65);
if (anime.setState('toString') || anime.state !== 'waving') fail.push('anime accepted an invalid pose');

anime.setState('thinking');
advanceAnime(60);
check('anime thinking wrist height', handY(), 1.24, 1.39);
checkExpression('thinkingMouth', 0.95, 1);
anime.setState('error');
advanceAnime(60);
checkExpression('worriedMouth', 0.95, 1);
checkExpression('thinkingMouth', 0, 0.05);
anime.setState('speaking');
advanceAnime(60);
const open = anime.parts.mouth.children[1];
check('anime mouth visible', open.material.opacity, 0.95, 1);
check('anime mouth opening', open.scale.y, 0.3, 1.1);
anime.setState('idle');
advanceAnime(60);
check('anime relaxed wrist height', handY(), 0.6, 0.7);
check('anime mouth hidden', open.material.opacity, 0, 0.05);
const pointer = anime.root.getObjectByName('teachingPointer');
const tip = anime.root.getObjectByName('pointerTip');
if (pointer.visible) fail.push('anime pointer should start hidden');
anime.setPointer(true);
anime.setState('point-right');
advanceAnime(60);
if (!pointer.visible || pointer.parent.name !== 'rHand') fail.push('anime pointer should move with the right hand');
check('right pointer reaches past the body', tip.getWorldPosition(new Vector3()).x, 0.95, 1.25);
anime.setState('point-left');
advanceAnime(60);
if (pointer.parent.name !== 'lHand') fail.push('anime pointer should move with the left hand');
check('left pointer reaches past the body', tip.getWorldPosition(new Vector3()).x, -1.25, -0.95);
anime.setPointer(false);
if (pointer.visible || anime.state !== 'point-left') fail.push('disabling the pointer should keep the selected pose');
anime.setState('presenting');
anime.setTalking(true);
advanceAnime(60);
check('anime talk can layer over a pose', open.material.opacity, 0.95, 1);
if (anime.state !== 'presenting') fail.push('talk replaced the presenter pose');
anime.setTalking(false);
advanceAnime(60);
check('anime talk toggle can stop layered speech', open.material.opacity, 0, 0.05);
anime.setState('nodding');
advanceAnime(22);
check('anime nod dips the head', anime.parts.head.rotation.x, 0.16, 0.29);
advanceAnime(48);
check('anime nod comes to rest', Math.abs(anime.parts.head.rotation.x), 0, 0.03);

const blinkMascot = createAnimeMascot();
blinkMascot.blink();
blinkMascot.update(1 / 60, 1 / 60);
check('anime eyelid compression', blinkMascot.parts.eyes[0].scale.y, 0.05, 0.25);
const closedLid = blinkMascot.root.getObjectByName('lClosedLid');
check('anime closed lid aligns with the eye', closedLid.position.y - blinkMascot.parts.eyes[0].position.y, -0.015, -0.005);
if (!closedLid.visible || blinkMascot.parts.eyes[0].visible) fail.push('anime did not switch to the closed eyelid');
blinkMascot.update(0.05, 0.2);
check('anime blink recovery', blinkMascot.parts.eyes[0].scale.y, 0.95, 1);
if (closedLid.visible || !blinkMascot.parts.eyes[0].visible) fail.push('anime did not reopen the eye');

if (fail.length) {
  console.error('Rig check FAILED\n' + fail.join('\n'));
  process.exit(1);
}
console.log('Rig check passed: original gestures and speech, anime poses, pointer, face, hair and blink');
