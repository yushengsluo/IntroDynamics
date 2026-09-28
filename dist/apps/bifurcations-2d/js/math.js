// The quadratic family x′ = x² − y² + 1, y′ = y − x² − a.
export const HOPF_A = Math.sqrt(5) / 2 - .25;

export function field(a, p) {
  return [p[0] * p[0] - p[1] * p[1] + 1, p[1] - p[0] * p[0] - a];
}

export function equilibriaFor(a) {
  if (!Number.isFinite(a) || a > 1 + 1e-12) return [];
  const root = Math.sqrt(5 - 4 * a), result = [];
  for (const [branch, y] of [['upper', (1 + root) / 2], ['lower', (1 - root) / 2]]) {
    const square = y * y - 1;
    if (square < -1e-12) continue;
    const r = Math.sqrt(Math.max(0, square));
    for (const x of r < 1e-10 ? [0] : [-r, r]) {
      const trace = 2 * x + 1, determinant = 2 * x * (1 - 2 * y);
      const discriminant = trace * trace - 4 * determinant;
      let type;
      if (Math.abs(determinant) < 1e-10) type = 'saddle-node';
      else if (determinant < 0) type = 'saddle';
      else if (Math.abs(trace) < 1e-10) type = 'hopf';
      else type = `${trace < 0 ? 'stable' : 'unstable'}-${discriminant >= 0 ? 'node' : 'focus'}`;
      const eigenvalues = discriminant >= 0
        ? [(trace - Math.sqrt(discriminant)) / 2, (trace + Math.sqrt(discriminant)) / 2]
        : [{re: trace / 2, im: -Math.sqrt(-discriminant) / 2}, {re: trace / 2, im: Math.sqrt(-discriminant) / 2}];
      const side = x < 0 ? 'left' : x > 0 ? 'right' : 'center';
      result.push({id: `${branch}-${side}`, x, y, type, trace, determinant, eigenvalues,
        label: `${branch === 'upper' ? 'Upper' : 'Lower'} ${side}`});
    }
  }
  return result;
}

export function saddleDirections(equilibrium) {
  const {x, y, eigenvalues} = equilibrium;
  if (equilibrium.type !== 'saddle') return [];
  return eigenvalues.map(value => {
    const vector = [-1, -(2 * x - value) / (2 * y)];
    const norm = Math.hypot(...vector);
    return {value, vector: vector.map(v => v / norm), kind: value < 0 ? 'stable' : 'unstable'};
  });
}

export function rk4(a, point, h) {
  const combine = (k, scale) => point.map((v, i) => v + scale * k[i]);
  const k1 = field(a, point), k2 = field(a, combine(k1, h / 2));
  const k3 = field(a, combine(k2, h / 2)), k4 = field(a, combine(k3, h));
  return point.map((v, i) => v + h * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6);
}

// RK4 step doubling controls both truncation error and distance between drawn points.
// Paths stop on escape instead of connecting a numerical overflow back to the view.
export function integrate(a, initial, options = {}) {
  const duration = options.duration ?? 45, direction = options.direction ?? 1;
  const bound = options.bound ?? 30, spacing = options.spacing ?? .035;
  const tolerance = options.tolerance ?? 2e-8, maxSteps = options.maxSteps ?? 16000;
  const points = [[...initial]];
  if (!Number.isFinite(a) || !initial.every(Number.isFinite)) return {points: [], stopped: 'invalid'};
  let p = [...initial], time = 0, h = .025, stopped = 'limit';
  for (let step = 0; step < maxSteps && time < duration; step++) {
    const speed = Math.hypot(...field(a, p));
    if (speed < 1e-9) { stopped = 'equilibrium'; break; }
    h = Math.min(h, .08, spacing / Math.max(speed, .01), duration - time);
    if (h < 1e-10) { stopped = 'escape'; break; }
    const full = rk4(a, p, direction * h);
    const half = rk4(a, rk4(a, p, direction * h / 2), direction * h / 2);
    if (!half.every(Number.isFinite)) { stopped = 'escape'; break; }
    const error = Math.hypot(half[0] - full[0], half[1] - full[1]);
    const limit = tolerance * (1 + Math.hypot(...half));
    if (error > 15 * limit) { h *= .5; continue; }
    p = half.map((v, i) => v + (v - full[i]) / 15);
    time += h;
    if (Math.hypot(p[0] - points.at(-1)[0], p[1] - points.at(-1)[1]) > spacing * .2 || time >= duration) points.push(p);
    if (Math.max(Math.abs(p[0]), Math.abs(p[1])) > bound) { stopped = 'escape'; break; }
    if (error < limit) h *= 1.6;
    if (step === maxSteps - 1) stopped = 'limit';
  }
  if (time >= duration) stopped = 'time';
  if (points.at(-1) !== p) points.push(p);
  return {points, stopped};
}

export function phasePaths(a, initials, options = {}) {
  const bound = options.bound ?? 30, spacing = options.spacing ?? .035;
  const paths = [], eqs = equilibriaFor(a);
  for (const e of eqs) for (const d of saddleDirections(e)) for (const side of [-1, 1]) {
    const initial = [e.x + side * 1e-5 * d.vector[0], e.y + side * 1e-5 * d.vector[1]];
    const result = integrate(a, initial, {bound, spacing, direction: d.value > 0 ? 1 : -1, duration: 70});
    let points = [[e.x, e.y], ...result.points];
    if (d.value < 0) points.reverse();
    paths.push({points, kind: d.kind, saddle: e.id, side, label: `${e.label} ${d.kind} branch`});
  }
  for (const initial of initials) {
    const settings = {bound, spacing, duration: options.duration ?? 25};
    const forward = integrate(a, initial, settings);
    const backward = integrate(a, initial, {...settings, direction: -1});
    paths.push({points: [...backward.points.reverse().slice(0, -1), ...forward.points], kind: 'trajectory'});
  }
  return paths;
}

export function equilibriumBranches(aMin, aMax, count = 650) {
  const samples = Array.from({length: count + 1}, (_, i) => aMin + (aMax - aMin) * i / count);
  samples.push(-1, 1, HOPF_A);
  samples.sort((a, b) => a - b);
  const branches = [], current = new Map();
  for (const a of samples.filter(a => a >= aMin && a <= aMax)) {
    const seen = new Set();
    for (const e of equilibriaFor(a)) {
      if (e.x === 0) {
        for (const b of current.values()) if (b.id.startsWith(e.id.split('-')[0])) b.points.push([a, 0]);
        continue;
      }
      seen.add(e.id);
      let branch = current.get(e.id);
      if (!branch || branch.type !== e.type) {
        const previous = branch?.points.at(-1);
        branch = {id: e.id, type: e.type, points: previous ? [previous] : []};
        current.set(e.id, branch); branches.push(branch);
      }
      branch.points.push([a, e.x]);
    }
    for (const key of current.keys()) if (!seen.has(key)) current.delete(key);
  }
  return branches.filter(b => b.points.length > 1);
}
