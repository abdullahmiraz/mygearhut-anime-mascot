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
anime.setState('speaking');
advanceAnime(60);
const open = anime.parts.mouth.children[1];
check('anime mouth visible', open.material.opacity, 0.95, 1);
check('anime mouth opening', open.scale.y, 0.3, 1.1);
anime.setState('idle');
advanceAnime(60);
check('anime relaxed wrist height', handY(), 0.6, 0.7);
check('anime mouth hidden', open.material.opacity, 0, 0.05);
anime.blink();
advanceAnime(1);
check('anime eyelid compression', anime.parts.eyes[0].scale.y, 0.05, 0.25);
advanceAnime(12);
check('anime blink recovery', anime.parts.eyes[0].scale.y, 0.95, 1);

if (fail.length) {
  console.error('Rig check FAILED\n' + fail.join('\n'));
  process.exit(1);
}
console.log('Rig check passed: original gestures and speech, anime poses, speech and blink');
