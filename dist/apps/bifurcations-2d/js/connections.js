// The heteroclinic parameter is exact; the homoclinic parameter is a
// converged numerical shooting estimate, not an algebraic identity.
export const PLASTIC = Math.cbrt((9 + Math.sqrt(69)) / 18) + Math.cbrt((9 - Math.sqrt(69)) / 18);
export const HETEROCLINIC_A = -PLASTIC - 1 / (4 * PLASTIC);
export const HOMOCLINIC_A = 0.7228957882244;

function connectionField([x, y], a) {
  return [x * x - y * y + 1, y - x * x - a];
}

function upperSaddle(a) {
  if (!Number.isFinite(a) || a >= 1) throw new RangeError('The upper saddle requires a < 1.');
  const y = (1 + Math.sqrt(5 - 4 * a)) / 2;
  return [Math.sqrt(y * y - 1), y];
}

function connectionStep(point, h, a) {
  const k1 = connectionField(point, a);
  const k2 = connectionField(point.map((v, i) => v + h * k1[i] / 2), a);
  const k3 = connectionField(point.map((v, i) => v + h * k2[i] / 2), a);
  const k4 = connectionField(point.map((v, i) => v + h * k3[i]), a);
  return point.map((v, i) => v + h * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6);
}

function shootConnectionBranch(a, unstable, options = {}) {
  const maxStep = options.maxStep ?? .02;
  const tolerance = options.tolerance ?? 1e-11;
  const epsilon = options.epsilon ?? 1e-6;
  const maxTime = options.maxTime ?? 100;
  if (![maxStep, tolerance, epsilon, maxTime].every(value => Number.isFinite(value) && value > 0)) {
    throw new RangeError('Shooting options must be finite positive numbers.');
  }
  const saddle = upperSaddle(a), [xs, ys] = saddle;
  const trace = 2 * xs + 1, determinant = 2 * xs * (1 - 2 * ys);
  const discriminant = Math.sqrt(trace * trace - 4 * determinant);
  const lambda = (trace + (unstable ? discriminant : -discriminant)) / 2;
  const direction = unstable ? 1 : -1;
  const vector = [-1, -(2 * xs - lambda) / (2 * ys)];
  const norm = Math.hypot(...vector);
  let point = saddle.map((value, i) => value + epsilon * vector[i] / norm);
  let h = maxStep, time = 0;
  const points = [saddle, point];

  for (let step = 0; step < 100000 && time < maxTime; step++) {
    h = Math.min(h, maxTime - time);
    const full = connectionStep(point, direction * h, a);
    const half = connectionStep(connectionStep(point, direction * h / 2, a), direction * h / 2, a);
    const error = Math.max(...full.map((value, i) => Math.abs(value - half[i]))) / Math.max(1, ...half.map(Math.abs));
    if (!Number.isFinite(error)) return null;
    if (error > tolerance) {
      h *= Math.max(.2, .9 * Math.pow(tolerance / error, .2));
      if (h < 1e-10) return null;
      continue;
    }
    const previous = point;
    point = half.map((value, i) => value + (value - full[i]) / 15);
    time += h;

    // The two inward branches reach the same horizontal transverse section
    // after going around opposite sides of the left equilibrium.
    if (point[0] < -xs && (point[1] - ys) * (previous[1] - ys) <= 0) {
      let low = 0, high = h, intersection = point;
      for (let iteration = 0; iteration < 40; iteration++) {
        const mid = (low + high) / 2;
        intersection = connectionStep(connectionStep(previous, direction * mid / 2, a), direction * mid / 2, a);
        if ((intersection[1] - ys) * (previous[1] - ys) > 0) low = mid;
        else high = mid;
      }
      intersection[1] = ys;
      points.push(intersection);
      return {intersection, points};
    }
    points.push(point);
    if (Math.max(...point.map(Math.abs)) > 10000) return null;
    h = Math.min(maxStep, h * Math.min(2, .9 * Math.pow(tolerance / Math.max(error, 1e-20), .2)));
  }
  return null;
}

// Signed distance on y = y_s, x < -x_s. NaN means that a branch did not
// reach this section within the integration bounds; it is not a root.
export function shootingResidual(a, options = {}) {
  const unstable = shootConnectionBranch(a, true, options);
  const stable = shootConnectionBranch(a, false, options);
  return unstable && stable ? unstable.intersection[0] - stable.intersection[0] : NaN;
}

export function exactHeteroclinicPoints(segments = 240) {
  const count = Math.max(1, Math.min(10000, Math.round(Number.isFinite(segments) ? segments : 240)));
  const discriminant = Math.sqrt(5 - 4 * HETEROCLINIC_A);
  const lowerY = (1 - discriminant) / 2, upperY = (1 + discriminant) / 2;
  // y = PLASTIC*x - 1/(2*PLASTIC) is an invariant line. Forward flow
  // travels from the lower-left saddle to the upper-right saddle.
  return Array.from({length: count + 1}, (_, index) => {
    const y = lowerY + (upperY - lowerY) * index / count;
    return [(y + 1 / (2 * PLASTIC)) / PLASTIC, y];
  });
}

let cachedHomoclinicPath = null;

export function homoclinicPath() {
  if (!cachedHomoclinicPath) {
    const unstable = shootConnectionBranch(HOMOCLINIC_A, true);
    const stable = shootConnectionBranch(HOMOCLINIC_A, false);
    if (!unstable || !stable) return [];
    // Join accurate half-orbits at their section instead of continuing a
    // forward orbit indefinitely near the saddle, where roundoff grows.
    const meeting = [(unstable.intersection[0] + stable.intersection[0]) / 2, unstable.intersection[1]];
    unstable.points[unstable.points.length - 1] = meeting;
    stable.points[stable.points.length - 1] = meeting;
    cachedHomoclinicPath = unstable.points.concat(stable.points.reverse().slice(1));
  }
  return cachedHomoclinicPath;
}
