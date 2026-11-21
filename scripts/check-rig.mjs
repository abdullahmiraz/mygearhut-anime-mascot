import { createMascot } from '../src/mascot.js';

const mascot = createMascot();
const fail = [];
const check = (label, value, min, max) => {
  if (value < min || value > max) fail.push(`${label}: ${value.toFixed(3)} not in [${min}, ${max}]`);
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

if (fail.length) {
  console.error('Rig check FAILED\n' + fail.join('\n'));
  process.exit(1);
}
console.log('Rig check passed: wave, point, talk, idle');
