const LIMIT = 1e8;
const MAX_STEP = .015;
const MIN_STEP = 1e-8;
const MAX_STEPS = 100000;
const finiteVector = vector => Array.isArray(vector) && vector.every(value => Number.isFinite(value) && Math.abs(value) <= LIMIT);
const copyVector = vector => vector && vector.slice();
const copyState = state => ({base: copyVector(state.base), variations: state.variations.map(copyVector)});

function derivative(preset, parameters, t, state) {
  if (!state.base) return {base: null, variations: state.variations.map(() => null)};
  const field = preset.field(t, state.base, parameters);
  const matrix = state.variations.length ? preset.jacobian(t, state.base, parameters) : [];
  return {
    base: finiteVector(field) ? field : null,
    variations: state.variations.map(vector => {
      if (!vector) return null;
      const result = matrix.map(row => row.reduce((sum, coefficient, index) => sum + coefficient * vector[index], 0));
      return finiteVector(result) ? result : null;
    })
  };
}

function shifted(state, slope, h) {
  const add = (vector, delta) => {
    if (!vector || !delta) return null;
    const result = vector.map((value, index) => value + h * delta[index]);
    return finiteVector(result) ? result : null;
  };
  const base = add(state.base, slope.base);
  return {base, variations: state.variations.map((vector, index) => base ? add(vector, slope.variations[index]) : null)};
}

function rk4(preset, parameters, state, t, h) {
  const a = derivative(preset, parameters, t, state);
  const b = derivative(preset, parameters, t + h / 2, shifted(state, a, h / 2));
  const c = derivative(preset, parameters, t + h / 2, shifted(state, b, h / 2));
  const d = derivative(preset, parameters, t + h, shifted(state, c, h));
  const combine = (vector, slopes) => {
    if (!vector || slopes.some(slope => !slope)) return null;
    const result = vector.map((value, index) => value + h * (slopes[0][index] + 2 * slopes[1][index] + 2 * slopes[2][index] + slopes[3][index]) / 6);
    return finiteVector(result) ? result : null;
  };
  const base = combine(state.base, [a.base, b.base, c.base, d.base]);
  return {base, variations: state.variations.map((vector, index) => base ? combine(vector, [a.variations[index], b.variations[index], c.variations[index], d.variations[index]]) : null)};
}

function errorEstimate(full, halves) {
  let error = 0;
  const compare = (left, right) => {
    if (!right) return;
    if (!left) {error = Infinity; return;}
    for (let index = 0; index < left.length; index++) {
      error = Math.max(error, Math.abs(left[index] - right[index]) / (15 * (1e-9 + 2e-7 * Math.max(Math.abs(left[index]), Math.abs(right[index])))));
    }
  };
  compare(full.base, halves.base);
  halves.variations.forEach((vector, index) => compare(full.variations[index], vector));
  return error;
}

// Each branch starts at t=0. Comparisons integrate separately so their growth
// cannot spoil an otherwise bounded base trajectory or another comparison.
function integrate(preset, parameters, initial, times, direction) {
  const result = new Map();
  let state = copyState(initial), t = 0, nextStep = MAX_STEP, steps = 0;
  for (const target of times) {
    while (state.base && direction * (target - t) > 1e-12) {
      if (++steps > MAX_STEPS) {
        state = {base: null, variations: state.variations.map(() => null)};
        break;
      }
      const magnitude = Math.min(nextStep, Math.abs(target - t));
      const h = direction * magnitude;
      const full = rk4(preset, parameters, state, t, h);
      const middle = rk4(preset, parameters, state, t, h / 2);
      const halves = rk4(preset, parameters, middle, t + h / 2, h / 2);
      const error = errorEstimate(full, halves);
      if ((!halves.base || error > 1) && magnitude > MIN_STEP) {
        nextStep = Math.max(MIN_STEP, magnitude * (Number.isFinite(error) && halves.base ? Math.max(.2, .85 * Math.pow(error, -.2)) : .25));
        continue;
      }
      // A missing tangent does not invalidate the base. At the minimum step,
      // stop a branch whose integration still cannot meet the error tolerance.
      if (!halves.base || error > 1) state = {base: null, variations: state.variations.map(() => null)};
      else state = halves;
      t += h;
      nextStep = Math.min(MAX_STEP, magnitude * (error ? Math.min(2, .9 * Math.pow(error, -.2)) : 2));
    }
    result.set(target, copyState(state));
  }
  return result;
}

function sampleTimes(start, end) {
  const intervals = Math.min(2000, Math.max(120, Math.ceil((end - start) / .035)));
  if (start < 0 && end > 0) {
    const leftCount = Math.max(1, Math.min(intervals - 1, Math.round(intervals * -start / (end - start))));
    const rightCount = intervals - leftCount;
    return [
      ...Array.from({length: leftCount}, (_, index) => start + (0 - start) * index / leftCount),
      0,
      ...Array.from({length: rightCount}, (_, index) => end * (index + 1) / rightCount)
    ];
  }
  return Array.from({length: intervals + 1}, (_, index) => index === intervals ? end : start + (end - start) * index / intervals);
}

export function solveVariational(preset, parameters, baseInitial, comparisonsInitial, startTime, endTime) {
  if (!preset || ![2, 3].includes(preset.dimension) || typeof preset.field !== 'function' || typeof preset.jacobian !== 'function') throw new TypeError('A 2D or 3D vector field and Jacobian are required.');
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime < -50 || endTime > 100 || startTime >= endTime) throw new RangeError('Use an increasing time interval within −50 and 100.');
  const validInitial = vector => finiteVector(vector) && vector.length === preset.dimension;
  if (!validInitial(baseInitial) || !Array.isArray(comparisonsInitial) || comparisonsInitial.length > 12 || !comparisonsInitial.every(validInitial)) throw new RangeError('Use finite initial coordinates and at most 12 comparison trajectories.');
  if (!parameters || typeof parameters !== 'object' || Object.values(parameters).some(value => !Number.isFinite(value))) throw new RangeError('All parameters must be finite.');
  for (const parameter of preset.parameters || []) {
    if (!Number.isFinite(parameters[parameter.key]) || parameters[parameter.key] < parameter.min || parameters[parameter.key] > parameter.max) throw new RangeError(`${parameter.label} is outside its supported range.`);
  }
  const variations = comparisonsInitial.map(vector => vector.map((value, index) => value - baseInitial[index]));
  if (!variations.every(finiteVector)) throw new RangeError('The initial displacements are too large.');
  const times = sampleTimes(startTime, endTime);
  const negativeTimes = times.filter(t => t < 0).reverse();
  const positiveTimes = times.filter(t => t >= 0);
  const build = initial => new Map([
    ...integrate(preset, parameters, initial, negativeTimes, -1),
    ...integrate(preset, parameters, initial, positiveTimes, 1)
  ]);
  const baseResults = build({base: baseInitial, variations});
  const comparisonResults = comparisonsInitial.map(vector => build({base: vector, variations: []}));
  const samples = times.map(t => {
    const state = baseResults.get(t);
    return {t, base: state.base, comparisons: comparisonResults.map(result => result.get(t).base), variations: state.variations};
  });
  const warnings = [];
  if (samples.some(sample => !sample.base)) warnings.push('Part of the base trajectory could not be resolved within the numerical limits. Try a shorter time interval.');
  if (samples.some(sample => sample.comparisons.some(vector => !vector))) warnings.push('A comparison trajectory exceeded the numerical limits; its remaining path is hidden.');
  if (samples.some(sample => sample.base && sample.variations.some(vector => !vector))) warnings.push('A tangent vector exceeded the numerical limits. The base and comparison trajectories continue independently.');
  return {samples, warnings, startTime, endTime};
}

export function sampleAt(solution, t) {
  if (!solution || !Array.isArray(solution.samples) || !solution.samples.length || !Number.isFinite(t)) throw new RangeError('A sampled solution and finite time are required.');
  const samples = solution.samples;
  if (t <= samples[0].t) return samples[0];
  if (t >= samples[samples.length - 1].t) return samples[samples.length - 1];
  let low = 0, high = samples.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (samples[middle].t <= t) low = middle;
    else high = middle;
  }
  const left = samples[low], right = samples[high];
  if (left.t === t) return left;
  const ratio = (t - left.t) / (right.t - left.t);
  const interpolate = (a, b) => a && b ? a.map((value, index) => value + (b[index] - value) * ratio) : null;
  return {
    t,
    base: interpolate(left.base, right.base),
    comparisons: left.comparisons.map((vector, index) => interpolate(vector, right.comparisons[index])),
    variations: left.variations.map((vector, index) => interpolate(vector, right.variations[index]))
  };
}
