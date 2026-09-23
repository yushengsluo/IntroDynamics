const TAU = Math.PI * 2;
const COMPARISON_DARK = ['#b9a2ff', '#f2cf74', '#77c9ef', '#ee91b1', '#b6d98a', '#d9ae82'];
const COMPARISON_LIGHT = ['#7651b7', '#967014', '#2479a4', '#ac416e', '#5b7f25', '#986033'];
const phaseCaches = new WeakMap();
const growthCaches = new WeakMap();

function palette(light) {
  return light
    ? { background: '#fafafa', grid: '#e3e4e4', axis: '#a2aaa7', text: '#626b67', base: '#087f66', vector: '#a8580c', field: '#ccd3d0', separation: '#66736c', prediction: '#c6813c', comparisons: COMPARISON_LIGHT }
    : { background: '#141414', grid: '#292b2a', axis: '#555c58', text: '#a0aaa5', base: '#61dfbd', vector: '#f6b77b', field: '#39423d', separation: '#a3b4aa', prediction: '#bb8657', comparisons: COMPARISON_DARK };
}

function directionalColor(colors, kind) {
  if (kind === 'stable') return colors.comparisons[2];
  if (kind === 'unstable') return colors.vector;
  return null;
}

function comparisonColor(colors, index, selected, kinds = []) {
  const direction = directionalColor(colors, kinds[index]);
  if (direction) return direction;
  if (index === selected) return colors.comparisons[0];
  const otherIndex = index < selected ? index : index - 1;
  const choices = kinds.some(kind => directionalColor(colors, kind))
    ? colors.comparisons.slice(1).filter(color => color !== directionalColor(colors, 'stable') && color !== directionalColor(colors, 'unstable'))
    : colors.comparisons.slice(1);
  return choices[otherIndex % choices.length];
}

function finitePoint(point, dimension) {
  return Array.isArray(point) && point.length >= dimension && point.slice(0, dimension).every(Number.isFinite);
}

function dimensions(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  if (!(width > 0 && height > 0)) return null;
  const ratio = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1));
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width, height };
}

function view(width, height, options) {
  const dimension = options.dimension === 3 ? 3 : 2;
  const range = Number.isFinite(options.range) && options.range > 0 ? options.range : 4;
  const scale = Math.min(width, height) / (2 * range * (dimension === 3 ? 1.65 : 1.14));
  const yaw = Number.isFinite(options.yaw) ? options.yaw : -0.65;
  const pitch = Number.isFinite(options.pitch) ? options.pitch : 0.5;
  const right = [Math.cos(yaw), -Math.sin(yaw), 0];
  const up = [Math.sin(yaw) * Math.sin(pitch), Math.cos(yaw) * Math.sin(pitch), Math.cos(pitch)];
  const project = point => {
    if (!finitePoint(point, dimension)) return null;
    const horizontal = dimension === 2 ? point[0] : point.reduce((sum, value, index) => sum + value * (right[index] || 0), 0);
    const vertical = dimension === 2 ? point[1] : point.reduce((sum, value, index) => sum + value * (up[index] || 0), 0);
    const result = [width / 2 + horizontal * scale, height / 2 - vertical * scale];
    return result.every(Number.isFinite) ? result : null;
  };
  return { dimension, range, scale, right, up, project };
}

function sliceIndex(axis) {
  if (axis === 0 || axis === 'x') return 0;
  if (axis === 1 || axis === 'y') return 1;
  return 2;
}

// Pixel coordinates and width/height are in CSS pixels, not canvas backing pixels.
export function pickPoint(px, py, width, height, options = {}) {
  if (![px, py, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  const camera = view(width, height, options);
  const horizontal = (px - width / 2) / camera.scale;
  const vertical = (height / 2 - py) / camera.scale;
  if (camera.dimension === 2) return [horizontal, vertical];
  const fixed = sliceIndex(options.sliceAxis);
  const value = Number.isFinite(options.sliceValue) ? options.sliceValue : 0;
  const free = [0, 1, 2].filter(axis => axis !== fixed);
  const [a, b] = free;
  const determinant = camera.right[a] * camera.up[b] - camera.right[b] * camera.up[a];
  if (Math.abs(determinant) < 0.025) return null;
  const h = horizontal - camera.right[fixed] * value;
  const v = vertical - camera.up[fixed] * value;
  const point = [0, 0, 0];
  point[fixed] = value;
  point[a] = (h * camera.up[b] - camera.right[b] * v) / determinant;
  point[b] = (camera.right[a] * v - h * camera.up[a]) / determinant;
  return point.every(Number.isFinite) ? point : null;
}

function gridStep(span, target = 12) {
  const raw = Math.max(Number.MIN_VALUE, span / target);
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const fraction = raw / power;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
}

function label(value) {
  if (Math.abs(value) < 1e-12) return '0';
  if (Math.abs(value) >= 1e4 || Math.abs(value) < 0.001) return value.toExponential(0).replace('e+', 'e');
  return Number(value.toPrecision(4)).toString();
}

// Liang–Barsky clipping keeps very large valid trajectory values out of Canvas paths.
function clipLine(a, b, width, height, margin = 0) {
  if (!a || !b) return null;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  let low = 0;
  let high = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [a[0] - margin, width - margin - a[0], a[1] - margin, height - margin - a[1]];
  for (let i = 0; i < 4; i += 1) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
    } else {
      const ratio = q[i] / p[i];
      if (p[i] < 0) low = Math.max(low, ratio);
      else high = Math.min(high, ratio);
      if (low > high) return null;
    }
  }
  return [[a[0] + low * dx, a[1] + low * dy], [a[0] + high * dx, a[1] + high * dy]];
}

function line(context, a, b, width, height) {
  const segment = clipLine(a, b, width, height);
  if (!segment) return;
  context.beginPath();
  context.moveTo(...segment[0]);
  context.lineTo(...segment[1]);
  context.stroke();
}

function arrow(context, start, end, width, height, color, lineWidth = 2, head = 7) {
  const segment = clipLine(start, end, width, height, 9);
  if (!segment) return;
  const [a, b] = segment;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = lineWidth;
  context.beginPath();
  context.moveTo(...a);
  context.lineTo(...b);
  context.stroke();
  if (length < 3) return;
  const size = Math.min(head, length * 0.45);
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  context.beginPath();
  context.moveTo(...b);
  context.lineTo(b[0] - size * Math.cos(angle - 0.48), b[1] - size * Math.sin(angle - 0.48));
  context.lineTo(b[0] - size * Math.cos(angle + 0.48), b[1] - size * Math.sin(angle + 0.48));
  context.closePath();
  context.fill();
}

function dot(context, point, radius, color, background, hollow, width, height) {
  if (!point || point[0] < -radius || point[0] > width + radius || point[1] < -radius || point[1] > height + radius) return;
  context.beginPath();
  context.arc(...point, radius, 0, TAU);
  context.fillStyle = hollow ? background : color;
  context.fill();
  context.strokeStyle = hollow ? color : background;
  context.lineWidth = hollow ? 1.8 : 1.7;
  context.stroke();
}

function drawGrid(context, width, height, camera, colors, options) {
  const { project, range, dimension } = camera;
  context.lineWidth = 1;
  context.strokeStyle = colors.grid;
  context.fillStyle = colors.text;
  context.font = '11px system-ui, sans-serif';
  const fixed = sliceIndex(options.sliceAxis);
  const fixedValue = Number.isFinite(options.sliceValue) ? options.sliceValue : 0;
  const free = dimension === 2 ? [0, 1] : [0, 1, 2].filter(axis => axis !== fixed);
  const extent = dimension === 2 ? Math.max(width, height) / (2 * camera.scale) : range * 1.3;
  const step = gridStep(2 * extent, dimension === 2 ? 16 : 12);
  const limit = Math.ceil(extent / step) * step;
  for (let n = Math.ceil(-limit / step); n <= Math.floor(limit / step); n += 1) {
    const value = n * step;
    for (const axis of free) {
      const across = free.find(candidate => candidate !== axis);
      const a = [0, 0, 0];
      const b = [0, 0, 0];
      if (dimension === 3) a[fixed] = b[fixed] = fixedValue;
      a[axis] = b[axis] = value;
      a[across] = -limit;
      b[across] = limit;
      line(context, project(a), project(b), width, height);
    }
  }
  context.strokeStyle = colors.axis;
  context.lineWidth = 1.2;
  const axisColors = options.light ? ['#946368', '#518474', '#637da4'] : ['#c89499', '#8aafa1', '#91a6c7'];
  for (let axis = 0; axis < dimension; axis += 1) {
    const a = [0, 0, 0];
    const b = [0, 0, 0];
    a[axis] = -limit;
    b[axis] = limit;
    line(context, project(a), project(b), width, height);
    const tip = [0, 0, 0];
    tip[axis] = dimension === 2 ? (axis === 0 ? width : height) / (2 * camera.scale) - 22 / camera.scale : range * 1.14;
    const position = project(tip);
    context.fillStyle = axisColors[axis];
    context.font = '600 12px system-ui, sans-serif';
    if (position) context.fillText(['x', 'y', 'z'][axis], position[0] + 5, position[1] - 7);
  }
  context.fillStyle = colors.text;
  context.font = '10px system-ui, sans-serif';
  if (dimension === 2) {
    for (let n = Math.ceil(-limit / step); n <= Math.floor(limit / step); n += 1) {
      const value = n * step;
      if (n === 0) continue;
      const x = project([value, 0]);
      const y = project([0, value]);
      context.textAlign = 'center';
      if (x[0] > 22 && x[0] < width - 30) context.fillText(label(value), x[0], height / 2 + 16);
      context.textAlign = 'right';
      if (y[1] > 20 && y[1] < height - 18) context.fillText(label(value), width / 2 - 8, y[1] + 3);
    }
  } else {
    for (const axis of free) {
      for (let n = -2; n <= 2; n += 1) {
        if (n === 0) continue;
        const point = [0, 0, 0];
        point[fixed] = fixedValue;
        point[axis] = n * step * 2;
        const projected = project(point);
        context.textAlign = 'center';
        if (projected) context.fillText(label(point[axis]), projected[0] + 5, projected[1] + 13);
      }
    }
  }
  context.textAlign = 'left';
}

function drawField(context, width, height, camera, colors, options) {
  if (!options.preset || typeof options.preset.field !== 'function') return;
  const { project, dimension, range } = camera;
  const t = Number.isFinite(options.frame?.t) ? options.frame.t : 0;
  const extent = dimension === 2 ? Math.max(width, height) / (2 * camera.scale) : range * 1.12;
  const step = gridStep(2 * extent, dimension === 2 ? 15 : 7);
  const count = Math.floor(extent / step);
  const fixed = sliceIndex(options.sliceAxis);
  const fixedValue = Number.isFinite(options.sliceValue) ? options.sliceValue : 0;
  const free = dimension === 2 ? [0, 1] : [0, 1, 2].filter(axis => axis !== fixed);
  for (let i = -count; i <= count; i += 1) {
    for (let j = -count; j <= count; j += 1) {
      const point = Array(dimension).fill(0);
      point[free[0]] = i * step;
      point[free[1]] = j * step;
      if (dimension === 3) point[fixed] = fixedValue;
      let vector;
      try { vector = options.preset.field(t, point, options.params || {}); } catch { continue; }
      if (!finitePoint(vector, dimension)) continue;
      const magnitude = Math.hypot(...vector);
      if (!(magnitude > 1e-12)) continue;
      const end = point.map((value, axis) => value + vector[axis] / magnitude * step * 0.43);
      const startPx = project(point);
      const endPx = project(end);
      if (!startPx || !endPx) continue;
      arrow(context, startPx, endPx, width, height, colors.field, 1, 3.8);
    }
  }
}

function path(context, samples, getter, camera, width, height, color, thickness, dash = [], key = '') {
  context.strokeStyle = color;
  context.lineWidth = thickness;
  context.setLineDash(dash);
  let cached = camera.paths?.get(key);
  if (cached) {
    context.stroke(cached);
    context.setLineDash([]);
    return;
  }
  const target = typeof globalThis.Path2D === 'function' ? new globalThis.Path2D() : context;
  if (target === context) context.beginPath();
  let previous = null;
  for (const sample of samples) {
    const current = camera.project(getter(sample));
    if (previous && current) {
      const segment = clipLine(previous, current, width, height);
      if (segment) {
        target.moveTo(...segment[0]);
        target.lineTo(...segment[1]);
      }
    }
    previous = current;
  }
  if (target === context) context.stroke();
  else {
    camera.paths?.set(key, target);
    context.stroke(target);
  }
  context.setLineDash([]);
}

function prediction(sample, selected, dimension) {
  if (!finitePoint(sample?.base, dimension) || !finitePoint(sample?.variations?.[selected], dimension)) return null;
  return sample.base.map((value, axis) => value + sample.variations[selected][axis]);
}

export function drawPhase(canvas, options = {}) {
  const surface = dimensions(canvas);
  if (!surface) return { arrowClipped: false, arrowUnavailable: true };
  const { context, width, height } = surface;
  const colors = palette(options.light);
  const camera = view(width, height, options);
  const samples = options.solution?.samples || [];
  const signature = [width, height, camera.dimension, camera.range, options.yaw, options.pitch].join('|');
  let cached = phaseCaches.get(canvas);
  if (!cached || cached.samples !== samples || cached.signature !== signature) {
    cached = { samples, signature, paths: new Map() };
    phaseCaches.set(canvas, cached);
  }
  camera.paths = cached.paths;
  const frame = options.frame;
  const selected = Math.max(0, Math.floor(options.selected || 0));
  const kinds = options.comparisonKinds || [];
  const highlighted = index => index === selected || !!directionalColor(colors, kinds[index]);
  const color = index => comparisonColor(colors, index, selected, kinds);
  const comparisonCount = Math.max(frame?.comparisons?.length || 0, samples[0]?.comparisons?.length || 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = colors.background;
  context.fillRect(0, 0, width, height);
  context.save();
  context.beginPath();
  context.rect(0, 0, width, height);
  context.clip();
  drawGrid(context, width, height, camera, colors, options);
  if (options.showField !== false) drawField(context, width, height, camera, colors, options);
  if (options.showPaths !== false) {
    for (let index = 0; index < comparisonCount; index += 1) {
      context.globalAlpha = highlighted(index) ? 0.82 : 0.43;
      path(context, samples, sample => sample.comparisons?.[index], camera, width, height, color(index), highlighted(index) ? 1.8 : 1.2, [], `comparison-${index}`);
    }
    context.globalAlpha = 0.9;
    path(context, samples, sample => sample.base, camera, width, height, colors.base, 2, [], 'base');
    context.globalAlpha = 1;
    if (options.showPrediction) path(context, samples, sample => prediction(sample, selected, camera.dimension), camera, width, height, directionalColor(colors, kinds[selected]) || colors.prediction, 1.5, [5, 5], `prediction-${selected}`);
  }
  const basePoint = camera.project(frame?.base);
  const comparisonPoint = camera.project(frame?.comparisons?.[selected]);
  if (options.showSeparation && basePoint && comparisonPoint) {
    context.strokeStyle = colors.separation;
    context.lineWidth = 1.2;
    context.setLineDash([4, 5]);
    line(context, basePoint, comparisonPoint, width, height);
    context.setLineDash([]);
  }
  const initialSample = samples.find(sample => Math.abs(sample.t) < 1e-10);
  const baseInitial = options.baseInitial || initialSample?.base;
  const comparisonInitial = options.comparisonInitial || initialSample?.comparisons || [];
  dot(context, camera.project(baseInitial), 5, colors.base, colors.background, true, width, height);
  comparisonInitial.forEach((point, index) => dot(context, camera.project(point), highlighted(index) ? 5 : 4, color(index), colors.background, true, width, height));
  for (let index = 0; index < comparisonCount; index += 1) {
    dot(context, camera.project(frame?.comparisons?.[index]), highlighted(index) ? 5.5 : 4, color(index), colors.background, false, width, height);
  }
  const inside = point => point && point[0] >= 9 && point[0] <= width - 9 && point[1] >= 9 && point[1] <= height - 9;
  const arrowIndices = options.showAllVariations ? Array.from({ length: comparisonCount }, (_, index) => index) : [selected];
  let arrowUnavailable = arrowIndices.length === 0;
  let arrowClipped = false;
  for (const index of arrowIndices) {
    const arrowEnd = camera.project(prediction(frame, index, camera.dimension));
    if (!basePoint || !arrowEnd) {
      arrowUnavailable = true;
      continue;
    }
    arrowClipped ||= !inside(basePoint) || !inside(arrowEnd);
    const arrowColor = directionalColor(colors, kinds[index]) || (options.showAllVariations ? color(index) : colors.vector);
    arrow(context, basePoint, arrowEnd, width, height, arrowColor, 2.4, 9);
  }
  dot(context, basePoint, 5.5, colors.base, colors.background, false, width, height);
  context.restore();
  return { arrowClipped, arrowUnavailable };
}

function metrics(sample, selected) {
  const base = sample?.base;
  const comparison = sample?.comparisons?.[selected];
  const variation = sample?.variations?.[selected];
  const dimension = base?.length || 0;
  const exact = dimension && finitePoint(base, dimension) && finitePoint(comparison, dimension)
    ? Math.hypot(...base.map((value, axis) => comparison[axis] - value)) : null;
  const tangent = dimension && finitePoint(variation, dimension) ? Math.hypot(...variation) : null;
  const error = exact !== null && tangent !== null ? Math.hypot(...base.map((value, axis) => comparison[axis] - value - variation[axis])) : null;
  return [exact, tangent, error].map(value => Number.isFinite(value) ? value : null);
}

function growthData(source, selected) {
  let cached = growthCaches.get(source);
  if (!cached) {
    cached = new Map();
    growthCaches.set(source, cached);
  }
  if (cached.has(selected)) return cached.get(selected);
  const samples = source.filter(sample => Number.isFinite(sample.t));
  const values = samples.map(sample => metrics(sample, selected));
  let minimum = Infinity;
  let maximum = 0;
  for (const record of values) {
    for (const value of record) {
      if (value !== null && value > 1e-14) {
        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
      }
    }
  }
  const data = { samples, values, minimum: Number.isFinite(minimum) ? minimum : 0.0001, maximum: maximum || 1 };
  cached.set(selected, data);
  return data;
}

export function drawGrowth(canvas, options = {}) {
  const surface = dimensions(canvas);
  if (!surface) return;
  const { context, width, height } = surface;
  const colors = palette(options.light);
  const selected = Math.max(0, Math.floor(options.selected || 0));
  const { samples, values, minimum, maximum } = growthData(options.solution?.samples || [], selected);
  context.clearRect(0, 0, width, height);
  context.fillStyle = colors.background;
  context.fillRect(0, 0, width, height);
  const area = { left: 55, top: 18, right: width - 18, bottom: height - 34 };
  if (area.right <= area.left || area.bottom <= area.top) return;
  let start = samples.length ? samples[0].t : (options.tStart || 0);
  let end = samples.length ? samples[samples.length - 1].t : (options.tEnd || 10);
  if (!(end > start)) end = start + 1;
  // A bounded logarithmic span keeps near-zero roundoff from dominating the plot.
  const logMax = Math.ceil(Math.log10(maximum));
  const logMin = Math.min(logMax - 2, Math.max(logMax - 12, Math.floor(Math.log10(minimum))));
  const x = t => area.left + (t - start) / (end - start) * (area.right - area.left);
  const y = value => area.bottom - (Math.max(logMin, Math.log10(Math.max(value, Math.pow(10, logMin)))) - logMin) / (logMax - logMin) * (area.bottom - area.top);
  context.font = '10px system-ui, sans-serif';
  context.fillStyle = colors.te