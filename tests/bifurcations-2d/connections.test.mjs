import assert from 'node:assert/strict';
import {PLASTIC, HETEROCLINIC_A, HOMOCLINIC_A, exactHeteroclinicPoints, homoclinicPath, shootingResidual} from '../../dist/apps/bifurcations-2d/js/connections.js';

const field = ([x, y], a) => [x * x - y * y + 1, y - x * x - a];
const close = (actual, expected, tolerance) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);

close(PLASTIC ** 3 - PLASTIC - 1, 0, 1e-14);
close(HETEROCLINIC_A, -1.5134373738064193, 2e-14);
const heteroclinic = exactHeteroclinicPoints();
assert.ok(heteroclinic[0][0] < 0 && heteroclinic.at(-1)[0] > 0);
assert.ok(heteroclinic[0][1] < -1 && heteroclinic.at(-1)[1] > 1);
assert.ok(Math.hypot(...field(heteroclinic[0], HETEROCLINIC_A)) < 1e-13);
assert.ok(Math.hypot(...field(heteroclinic.at(-1), HETEROCLINIC_A)) < 1e-13);
for (const point of heteroclinic.slice(1, -1)) {
  const [dx, dy] = field(point, HETEROCLINIC_A);
  close(dy - PLASTIC * dx, 0, 2e-14);
  assert.ok(dx > 0 && dy > 0, 'The heteroclinic travels from the lower to the upper saddle.');
}

// Opposite signs on either side establish a transverse shooting root;
// independently tighten both the local seed and the integration accuracy.
assert.ok(shootingResidual(.70) > .035);
assert.ok(shootingResidual(.75) < -.042);
for (const options of [
  {maxStep: .02, tolerance: 1e-10, epsilon: 1e-5},
  {maxStep: .01, tolerance: 1e-12, epsilon: 1e-6},
  {maxStep: .005, tolerance: 1e-13, epsilon: 1e-7}
]) {
  assert.ok(Math.abs(shootingResidual(HOMOCLINIC_A, options)) < 2e-10);
  assert.ok(shootingResidual(HOMOCLINIC_A - 1e-8, options) > 1e-8);
  assert.ok(shootingResidual(HOMOCLINIC_A + 1e-8, options) < -1e-8);
}
assert.throws(() => shootingResidual(1), RangeError);
assert.throws(() => shootingResidual(HOMOCLINIC_A, {tolerance: 0}), RangeError);
assert.ok(Number.isNaN(shootingResidual(HOMOCLINIC_A, {maxTime: .001})));

const loop = homoclinicPath();
assert.ok(loop.length > 300 && loop.length < 10000);
assert.equal(loop, homoclinicPath(), 'The numerical connection is cached.');
assert.deepEqual(loop[0], loop.at(-1));
assert.ok(Math.hypot(...field(loop[0], HOMOCLINIC_A)) < 1e-14);
const [xs, ys] = loop[0];
const section = loop.find(point => point[0] < -xs && point[1] === ys);
assert.ok(section);
close(section[0], -1.176106858018, 2e-10);

// The joined path follows the actual vector field in forward time on both
// halves, closes at the saddle, and winds once around the left equilibrium.
let angle = 0;
for (let i = 1; i < loop.length; i++) {
  const before = loop[i - 1], after = loop[i];
  assert.ok(after.every(Number.isFinite));
  const chord = after.map((value, j) => value - before[j]);
  const midpoint = after.map((value, j) => (value + before[j]) / 2);
  const velocity = field(midpoint, HOMOCLINIC_A);
  const scale = Math.hypot(...chord) * Math.hypot(...velocity);
  assert.ok(chord[0] * velocity[0] + chord[1] * velocity[1] > 0);
  assert.ok(Math.abs(chord[0] * velocity[1] - chord[1] * velocity[0]) / scale < .001);
  const first = [before[0] + xs, before[1] - ys], second = [after[0] + xs, after[1] - ys];
  angle += Math.atan2(first[0] * second[1] - first[1] * second[0], first[0] * second[0] + first[1] * second[1]);
}
close(angle, 2 * Math.PI, 1e-10);
console.log('Bifurcation connection tests passed.');
