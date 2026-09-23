import assert from 'node:assert/strict';
import {presets} from '../../dist/apps/variational-equations/js/models.js';
import {solveVariational} from '../../dist/apps/variational-equations/js/solver.js';

const parametersFor = preset => Object.fromEntries(preset.parameters.map(parameter => [parameter.key, parameter.value]));
const close = (actual, expected, tolerance = 4e-8) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} ≠ ${expected}`);
const closeVector = (actual, expected) => {
  assert.ok(actual, 'A variational displacement must be available');
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => close(value, expected[index]));
};
const rotated = (v, angle, scale = 1) => [
  scale * (v[0] * Math.cos(angle) - v[1] * Math.sin(angle)),
  scale * (v[0] * Math.sin(angle) + v[1] * Math.cos(angle))
];

// Compare each exact spectrum against an independently specified expression,
// including edited parameters and the allowed neutral boundary of the old spiral.
const spectra = {
  'stable-node': p => [-p.a, -p.c],
  saddle: p => [p.a, -p.c],
  'spiral-3d': p => [-p.a, -p.a, -p.c],
  'unstable-node': p => [p.a, p.c],
  'contracting-spiral': p => [-p.a, -p.a],
  center: () => [0, 0],
  shear: () => [0, 0],
  'expanding-spiral-3d': p => [p.a, p.a, p.c],
  'stable-node-3d': p => [-p.a, -p.b, -p.c],
  'neutral-rotation-3d': () => [0, 0, 0]
};
const expectedFlows = {
  'stable-node': (p, v, t) => [v[0] * Math.exp(-p.a * t), v[1] * Math.exp(-p.c * t)],
  saddle: (p, v, t) => [v[0] * Math.exp(p.a * t), v[1] * Math.exp(-p.c * t)],
  'spiral-3d': (p, v, t) => [...rotated(v, p.omega * t, Math.exp(-p.a * t)), v[2] * Math.exp(-p.c * t)],
  'unstable-node': (p, v, t) => [v[0] * Math.exp(p.a * t), v[1] * Math.exp(p.c * t)],
  'contracting-spiral': (p, v, t) => rotated(v, p.omega * t, Math.exp(-p.a * t)),
  center: (p, v, t) => rotated(v, p.omega * t),
  shear: (p, v, t) => [v[0] + p.s * t * v[1], v[1]],
  'expanding-spiral-3d': (p, v, t) => [...rotated(v, p.omega * t, Math.exp(p.a * t)), v[2] * Math.exp(p.c * t)],
  'stable-node-3d': (p, v, t) => [v[0] * Math.exp(-p.a * t), v[1] * Math.exp(-p.b * t), v[2] * Math.exp(-p.c * t)],
  'neutral-rotation-3d': (p, v, t) => [...rotated(v, p.omega * t), v[2]]
};

for (const [id, expectedSpectrum] of Object.entries(spectra)) {
  const preset = presets.find(item => item.id === id);
  assert.ok(preset, `Missing preset ${id}`);
  assert.equal(typeof preset.lyapunov, 'function');
  const defaults = parametersFor(preset);
  for (const parameters of [defaults, ...['min', 'max'].map(bound => Object.fromEntries(preset.parameters.map(parameter => [parameter.key, parameter[bound]])))]) {
    const metadata = preset.lyapunov(parameters);
    assert.deepEqual(metadata.exponents, expectedSpectrum(parameters), `${id} spectrum must reflect edited parameters`);
    assert.equal(metadata.exponents.length, preset.dimension, `${id} spectrum must include multiplicities`);
    assert.ok(metadata.note.length > 20);
    if (preset.group === 'Positive Lyapunov exponent') assert.ok(Math.max(...metadata.exponents) > 0);
    if (preset.group === 'Negative Lyapunov exponent') assert.ok(Math.max(...metadata.exponents) < 0);
    if (preset.group === 'Zero Lyapunov exponent') assert.equal(Math.max(...metadata.exponents), 0);
  }

  const variation = [.3, -.2, .4].slice(0, preset.dimension);
  const comparison = preset.base.map((value, index) => value + variation[index]);
  const solution = solveVariational(preset, defaults, preset.base, [comparison], -2, 4);
  assert.equal(solution.warnings.length, 0, `${id} should remain finite in this interval`);
  for (const sample of solution.samples) {
    closeVector(sample.variations[0], expectedFlows[id](defaults, variation, sample.t));
    closeVector(sample.comparisons[0].map((value, index) => value - sample.base[index]), sample.variations[0]);
  }

  // Coordinate directions are invariant axes or lie in a rotation plane, so
  // their finite-time norm rates exactly match the real spectral exponents.
  if (id !== 'shear') {
    const directions = Array.from({length: preset.dimension}, (_, axis) => Array.from({length: preset.dimension}, (_, index) => axis === index ? 1 : 0));
    const comparisonInitials = directions.map(direction => preset.base.map((value, index) => value + direction[index]));
    const final = solveVariational(preset, defaults, preset.base, comparisonInitials, 0, 4).samples.at(-1);
    final.variations.forEach((vector, index) => close(Math.log(Math.hypot(...vector)) / final.t, expectedSpectrum(defaults)[index]));
  }
}

for (const [group, counts] of [
  ['Positive Lyapunov exponent', [1, 1]],
  ['Negative Lyapunov exponent', [1, 1]],
  ['Zero Lyapunov exponent', [2, 1]]
]) {
  [2, 3].forEach((dimension, index) => assert.equal(presets.filter(preset => preset.group === group && preset.dimension === dimension).length, counts[index]));
}

// A zero exponent need not mean constant separation. This non-diagonalizable
// flow has eta(t) = (s t, 1), whose norm grows linearly but subexponentially.
const shear = presets.find(preset => preset.id === 'shear');
const shearParameters = parametersFor(shear);
const rates = [];
for (const endTime of [20, 100]) {
  const last = solveVariational(shear, shearParameters, [0, 0], [[0, 1]], 0, endTime).samples.at(-1);
  closeVector(last.variations[0], [shearParameters.s * endTime, 1]);
  const length = Math.hypot(...last.variations[0]);
  close(length, Math.sqrt(1 + (shearParameters.s * endTime) ** 2));
  rates.push(Math.log(length) / endTime);
}
assert.ok(rates[0] > rates[1] && rates[1] > 0, 'The positive finite-time shear rate decreases toward its zero asymptotic exponent');

console.log('Passed: exact Lyapunov spectra, parameter-dependent signs, linear tangent solutions, directional exponential rates, and zero-exponent shear growth.');
