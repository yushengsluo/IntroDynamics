import assert from 'node:assert/strict';
import {presets} from '../../dist/apps/variational-equations/js/models.js';
import {solveVariational, sampleAt} from '../../dist/apps/variational-equations/js/solver.js';

const parametersFor = preset => Object.fromEntries(preset.parameters.map(parameter => [parameter.key, parameter.value]));
const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} ≠ ${expected}`);
const closeVector = (actual, expected, tolerance) => {
  assert.ok(actual, 'Expected a finite vector');
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => close(value, expected[index], tolerance));
};

assert.equal(new Set(presets.map(preset => preset.id)).size, presets.length);
assert.ok(presets.filter(preset => preset.dimension === 2).length >= 5);
assert.ok(presets.filter(preset => preset.dimension === 3).length >= 3);
for (const preset of presets) {
  const parameters = parametersFor(preset);
  assert.equal(preset.base.length, preset.dimension);
  assert.equal(preset.comparison.length, preset.dimension);
  for (const x of [preset.base, preset.comparison, Array.from({length: preset.dimension}, (_, i) => .7 - .9 * i)]) {
    const matrix = preset.jacobian(.4, x, parameters);
    const h = 1e-5;
    for (let column = 0; column < preset.dimension; column++) {
      const above = x.slice(), below = x.slice();
      above[column] += h;
      below[column] -= h;
      const upperField = preset.field(.4, above, parameters), lowerField = preset.field(.4, below, parameters);
      for (let row = 0; row < preset.dimension; row++) close(matrix[row][column], (upperField[row] - lowerField[row]) / (2 * h), 2e-8);
    }
  }
  const solution = solveVariational(preset, parameters, preset.base, [preset.comparison], 0, 1.2);
  const atZero = sampleAt(solution, 0);
  closeVector(atZero.base, preset.base, 0);
  closeVector(atZero.comparisons[0], preset.comparison, 0);
  closeVector(atZero.variations[0], preset.comparison.map((value, i) => value - preset.base[i]), 0);
  assert.equal(solution.warnings.length, 0, preset.name);

  // Independently integrate two nonlinear nearby trajectories and compare their
  // first difference with the derivative of the flow propagated by the Jacobian.
  const epsilon = 1e-5;
  const displaced = preset.base.map((value, i) => value + epsilon * (i + 1));
  const derivativeTime = Math.min(.8, preset.endTime / 2);
  const nearby = solveVariational(preset, parameters, preset.base, [displaced], 0, derivativeTime);
  const final = nearby.samples.at(-1);
  const remainder = final.comparisons[0].map((value, i) => value - final.base[i] - final.variations[0][i]);
  assert.ok(Math.hypot(...remainder) < 2e-7, `${preset.name}: nonlinear remainder is too large`);
}

const stable = presets.find(preset => preset.id === 'stable-node');
const stableParameters = parametersFor(stable);
for (const [start, end] of [[-3, 5], [-4, -1], [2, 6], [-.001, .03]]) {
  const base = [2, -1], comparison = [2.2, -.6];
  const solution = solveVariational(stable, stableParameters, base, [comparison], start, end);
  assert.equal(solution.samples[0].t, start);
  assert.equal(solution.samples.at(-1).t, end);
  assert.ok(solution.samples.length <= 2001);
  if (start < 0 && end > 0) assert.equal(solution.samples.filter(sample => sample.t === 0).length, 1);
  solution.samples.forEach((sample, index) => {
    assert.ok(index === 0 || sample.t > solution.samples[index - 1].t);
    const scale = [Math.exp(-stableParameters.a * sample.t), Math.exp(-stableParameters.c * sample.t)];
    closeVector(sample.base, base.map((value, i) => value * scale[i]), 2e-8);
    closeVector(sample.comparisons[0], comparison.map((value, i) => value * scale[i]), 2e-8);
    closeVector(sample.variations[0], comparison.map((value, i) => (value - base[i]) * scale[i]), 2e-8);
    closeVector(sample.base.map((value, i) => value + sample.variations[0][i]), sample.comparisons[0], 2e-8);
  });
  assert.deepEqual(sampleAt(solution, start - 1), solution.samples[0]);
  assert.deepEqual(sampleAt(solution, end + 1), solution.samples.at(-1));
}

const spiral = presets.find(preset => preset.id === 'spiral-3d');
const spiralParameters = parametersFor(spiral);
const spiralSolution = solveVariational(spiral, spiralParameters, spiral.base, [spiral.comparison], -2, 8);
for (const sample of spiralSolution.samples) {
  const rotation = spiralParameters.omega * sample.t, scale = Math.exp(-spiralParameters.a * sample.t);
  closeVector(sample.base, [
    scale * (spiral.base[0] * Math.cos(rotation) - spiral.base[1] * Math.sin(rotation)),
    scale * (spiral.base[0] * Math.sin(rotation) + spiral.base[1] * Math.cos(rotation)),
    spiral.base[2] * Math.exp(-spiralParameters.c * sample.t)
  ], 2e-8);
}

const bounded = {
  dimension: 2, parameters: [],
  field: (t, [x, y]) => [x * (1 - x * x), -y],
  jacobian: (t, [x]) => [[1 - 3 * x * x, 0], [0, -1]]
};
const growingTangent = solveVariational(bounded, {}, [0, 0], [[.1, 0], [0, .1]], 0, 40);
const finalBounded = growingTangent.samples.at(-1);
assert.deepEqual(finalBounded.base, [0, 0]);
closeVector(finalBounded.comparisons[0], [1, 0]);
assert.equal(finalBounded.variations[0], null, 'An unbounded tangent must be truncated');
assert.ok(finalBounded.variations[1], 'Another tangent must continue independently');
assert.ok(growingTangent.warnings.some(warning => warning.includes('tangent')));

const saddle = presets.find(preset => preset.id === 'saddle');
const hugeWindow = solveVariational(saddle, parametersFor(saddle), [0, 0], [[0, 1], [1, 0]], -50, 100);
assert.equal(hugeWindow.samples[0].t, -50);
assert.equal(hugeWindow.samples.at(-1).t, 100);
assert.ok(hugeWindow.samples.length <= 2001);
assert.ok(hugeWindow.samples.every(sample => sample.base && sample.base.every(value => value === 0)));
const atZero = sampleAt(hugeWindow, 0);
assert.deepEqual(atZero.comparisons, [[0, 1], [1, 0]], 'Backward truncation must not contaminate the forward branch');
const overflowSample = hugeWindow.samples.find(sample => !sample.comparisons[1]);
assert.ok(overflowSample);
assert.equal(sampleAt(hugeWindow, overflowSample.t).comparisons[1], null);

const stiff = {dimension: 2, parameters: [], field: (t, [x, y]) => [-1000 * x, -y], jacobian: () => [[-1000, 0], [0, -1]]};
const stiffSolution = solveVariational(stiff, {}, [1, 1], [[1.01, 1.01]], 0, .1);
closeVector(stiffSolution.samples.at(-1).base, [Math.exp(-100), Math.exp(-.1)], 1e-8);
assert.equal(stiffSolution.warnings.length, 0);

for (const [start, end] of [[1, 1], [2, 1], [-51, 1], [0, 101], [NaN, 2], [0, Infinity]]) assert.throws(() => solveVariational(stable, stableParameters, stable.base, [stable.comparison], start, end), RangeError);
for (const initial of [[NaN, 0], [Infinity, 0], [0], [0, 0, 0]]) assert.throws(() => solveVariational(stable, stableParameters, initial, [], 0, 1), RangeError);
for (const badParameters of [{}, {a: NaN, c: 1}, {a: -1, c: 1}, {a: 1, c: 5}]) assert.throws(() => solveVariational(stable, badParameters, stable.base, [], 0, 1), RangeError);
assert.throws(() => solveVariational(stable, stableParameters, stable.base, Array.from({length: 13}, () => [0, 0]), 0, 1), RangeError);
assert.throws(() => sampleAt({samples: []}, 0), RangeError);
assert.throws(() => sampleAt(spiralSolution, NaN), RangeError);
console.log('Passed: preset Jacobians, tangent flow derivatives, exact linear solutions, signed intervals, adaptive integration, independent truncation, and input bounds.');
