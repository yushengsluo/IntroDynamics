import assert from 'node:assert/strict';
import {presets} from '../../dist/apps/variational-equations/js/models.js';
import {solveVariational} from '../../dist/apps/variational-equations/js/solver.js';

const parametersFor = preset => Object.fromEntries(preset.parameters.map(parameter => [parameter.key, parameter.value]));
const difference = (point, base) => point.map((value, index) => value - base[index]);
const norm = vector => Math.hypot(...vector);
const close = (actual, expected, tolerance = 2e-7) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} ≠ ${expected}`);
const closeVector = (actual, expected, tolerance) => {
  assert.ok(actual, 'Expected a finite vector');
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => close(value, expected[index], tolerance));
};
const saddle = presets.find(preset => preset.id === 'saddle-3d');
assert.ok(saddle, 'The 3D hyperbolic demonstration must remain available');
assert.ok(presets.some(preset => preset.id === 'lorenz'), 'Keep the original chaotic-attractor example available');
for (const preset of [saddle]) {
  const p = parametersFor(preset);
  const seeds = preset.directionalComparisons(p, preset.base);
  assert.deepEqual(seeds.comparisons.map(seed => seed.kind), ['stable', 'unstable']);
  assert.deepEqual(seeds.comparisons[0].point, preset.comparison, 'The legacy comparison must match the first default seed');
  assert.ok(norm(preset.field(0, preset.base, p)) > 0, 'Use a moving base trajectory');
  const solution = solveVariational(preset, p, preset.base, seeds.comparisons.map(seed => seed.point), 0, preset.endTime);
  assert.deepEqual(solution.warnings, []);
  let previousStable = Infinity, previousUnstable = 0;
  for (const sample of solution.samples) {
    const stableLength = norm(sample.variations[0]), unstableLength = norm(sample.variations[1]);
    assert.ok(stableLength < previousStable, `${preset.id}: stable tangent must contract`);
    assert.ok(unstableLength > previousUnstable, `${preset.id}: unstable tangent must grow`);
    previousStable = stableLength;
    previousUnstable = unstableLength;
    // The stable comparison agrees exactly with this linear variational flow.
    closeVector(difference(sample.comparisons[0], sample.base), sample.variations[0]);
  }
  assert.ok(norm(difference(solution.samples.at(-1).comparisons[0], solution.samples.at(-1).base)) < norm(difference(preset.comparison, preset.base)));
}

// Hyperbolic splitting is exact about every base of this linear system, not just
// a stationary solution or a base lying entirely in a stable coordinate plane.
for (const base of [[.25, 1.5, 1], [-2, .3, -1], [0, 0, 0]]) {
  const p = {a: .3, b: .8, c: 1.2};
  const seeds = saddle.directionalComparisons(p, base).comparisons.map(seed => seed.point);
  const solution = solveVariational(saddle, p, base, seeds, -.5, 2);
  for (const sample of solution.samples) {
    const rates = [Math.exp(p.a * sample.t), Math.exp(-p.b * sample.t), Math.exp(-p.c * sample.t)];
    closeVector(sample.base, base.map((value, i) => value * rates[i]));
    for (let i = 0; i < 2; i++) {
      closeVector(sample.comparisons[i], seeds[i].map((value, j) => value * rates[j]));
      closeVector(sample.variations[i], difference(seeds[i], base).map((value, j) => value * rates[j]));
    }
  }
}
assert.deepEqual(saddle.lyapunov({a: .3, b: .8, c: 1.2}).exponents, [.3, -.8, -1.2]);

console.log('Passed: moving hyperbolic bases, exact stable/unstable linear splitting, and preserved original Lorenz preset.');
