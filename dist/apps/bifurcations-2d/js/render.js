const TAU = 2 * Math.PI;
const DIAGRAM_LEFT = 48;
const DIAGRAM_RIGHT = 18;

function palette(light) {
  return light
    ? { background: '#fafafa', grid: '#e3e4e4', axis: '#a2aaa7', text: '#626b67', field: '#c2cdc7', stable: '#2479a4', unstable: '#a8580c', trajectory: '#7651b7', connection: '#a83d7d', attractor: '#087f66', repeller: '#b64655', xNull: '#737a80', yNull: '#817a72', critical: '#977114' }
    : { background: '#141414', grid: '#292b2a', axis: '#555c58', text: '#a0aaa5', field: '#3d4942', stable: '#77c9ef', unstable: '#f6b77b', trajectory: '#b9a2ff', connection: '#e8a2cf', attractor: '#61dfbd', repeller: '#ef8797', xNull: '#7f878d', yNull: '#96918a', critical: '#e7c776' };
}

function finitePoint(point) {
  return Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

function dimensions(canvas) {
  const { width, height } = canvas.getBoundingClientRect();
  if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) return null;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const ratio = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1));
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width, height };
}

function camera(width, height, view = {}) {
  const cx = Number.isFinite(view.cx) ? view.cx : 0;
  const cy = Number.isFinite(view.cy) ? view.cy : 0;
  const range = Number.isFinite(view.range) && view.range > 0 ? Math.max(1e-12, Math.min(1e100, view.range)) : 3;
  const scale = Math.min(width, height) / (2 * range);
  const project = point => {
    if (!finitePoint(point)) return null;
    const result = [width / 2 + (point[0] - cx) * scale, height / 2 - (point[1] - cy) * scale];
    return finitePoint(result) ? result : null;
  };
  return { cx, cy, range, scale, project, xMin: cx - width / (2 * scale), xMax: cx + width / (2 * scale), yMin: cy - height / (2 * scale), yMax: cy + height / (2 * scale) };
}

// All public picking coordinates use CSS pixels, independently of devicePixelRatio.
export function pickPoint(px, py, width, height, view = {}) {
  if (![px, py, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  const { cx, cy, scale } = camera(width, height, view);
  const point = [cx + (px - width / 2) / scale, cy + (height / 2 - py) / scale];
  return finitePoint(point) ? point : null;
}

function parameterBounds(options = {}) {
  const aMin = Number.isFinite(options.aMin) ? options.aMin : -2;
  const aMax = Number.isFinite(options.aMax) && options.aMax > aMin ? options.aMax : aMin + 4;
  return { aMin, aMax };
}

export function pickParameter(px, width, options = {}) {
  if (![px, width].every(Number.isFinite) || width <= DIAGRAM_LEFT + DIAGRAM_RIGHT) return null;
  const { aMin, aMax } = parameterBounds(options);
  const fraction = Math.max(0, Math.min(1, (px - DIAGRAM_LEFT) / (width - DIAGRAM_LEFT - DIAGRAM_RIGHT)));
  return aMin + fraction * (aMax - aMin);
}

function gridStep(span, target = 10) {
  if (!(span > 0 && Number.isFinite(span))) return 1;
  const raw = Math.max(1e-300, span / target);
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
}

function ticks(minimum, maximum, step) {
  const values = [];
  if (![minimum, maximum, step].every(Number.isFinite) || step <= 0) return values;
  const start = Math.ceil(minimum / step);
  const count = Math.min(100, Math.floor(maximum / step) - start + 1);
  for (let i = 0; i < count; i += 1) values.push((start + i) * step);
  return values;
}

function format(value) {
  if (Math.abs(value) < 1e-12) return '0';
  if (Math.abs(value) >= 1e4 || Math.abs(value) < 0.001) return value.toExponential(0).replace('e+', 'e');
  return Number(value.toPrecision(4)).toString();
}

// Clip before sending values to Canvas: divergent solutions never produce huge paths.
function clipLine(a, b, rect) {
  if (!a || !b) return null;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  let low = 0;
  let high = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [a[0] - rect.left, rect.right - a[0], a[1] - rect.top, rect.bottom - a[1]];
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
  const clampPoint = point => [Math.max(rect.left, Math.min(rect.right, point[0])), Math.max(rect.top, Math.min(rect.bottom, point[1]))];
  return [clampPoint([a[0] + low * dx, a[1] + low * dy]), clampPoint([a[0] + high * dx, a[1] + high * dy])];
}

function line(context, a, b, rect) {
  const segment = clipLine(a, b, rect);
  if (!segment) return;
  context.beginPath();
  context.moveTo(...segment[0]);
  context.lineTo(...segment[1]);
  context.stroke();
}

function head(context, a, b, size = 6) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < 0.01) return;
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  context.beginPath();
  context.moveTo(...b);
  context.lineTo(b[0] - size * Math.cos(angle - 0.48), b[1] - size * Math.sin(angle - 0.48));
  context.lineTo(b[0] - size * Math.cos(angle + 0.48), b[1] - size * Math.sin(angle + 0.48));
  context.closePath();
  context.fill();
}

function polyline(context, points, project, rect, arrows = false) {
  let previous = null;
  let lastEnd = null;
  let distance = 42;
  const heads = [];
  context.beginPath();
  for (const point of points || []) {
    const current = project(point);
    const segment = clipLine(previous, current, rect);
    if (segment) {
      // Keep the dash phase along connected samples; restart only at a real gap.
      if (!lastEnd || Math.hypot(lastEnd[0] - segment[0][0], lastEnd[1] - segment[0][1]) > 1e-7) context.moveTo(...segment[0]);
      context.lineTo(...segment[1]);
      lastEnd = segment[1];
      const length = Math.hypot(segment[1][0] - segment[0][0], segment[1][1] - segment[0][1]);
      if (arrows && length > 0) {
        distance += length;
        if (distance >= 92 && heads.length < 12) {
          const fraction = Math.max(0.15, Math.min(0.85, (length - (distance - 92)) / length));
          const end = segment[0].map((value, index) => value + fraction * (segment[1][index] - value));
          heads.push([segment[0], end]);
          distance = 0;
        }
      }
    } else {
      lastEnd = null;
      if (!current) distance = 42;
    }
    previous = current;
  }
  context.stroke();
  for (const [a, b] of heads) head(context, a, b, 6);
}

function drawGrid(context, width, height, camera, colors, rect) {
  const { project, xMin, xMax, yMin, yMax } = camera;
  const step = gridStep(90 / camera.scale, 1);
  const origin = project([0, 0]) || [width / 2, height / 2];
  const labelY = Math.max(16, Math.min(height - 12, origin[1] + 15));
  const labelX = Math.max(27, Math.min(width - 16, origin[0] - 8));
  context.font = '10px system-ui, sans-serif';
  context.lineWidth = 1;
  context.setLineDash([]);
  context.fillStyle = colors.text;
  for (const x of ticks(xMin, xMax, step)) {
    const point = project([x, 0]);
    if (!point) continue;
    context.strokeStyle = Math.abs(x) < step * 1e-8 ? colors.axis : colors.grid;
    line(context, [point[0], 0], [point[0], height], rect);
    context.textAlign = 'center';
    if (point[0] > 20 && point[0] < width - 25) context.fillText(format(x), point[0], labelY);
  }
  for (const y of ticks(yMin, yMax, step)) {
    const point = project([0, y]);
    if (!point) continue;
    context.strokeStyle = Math.abs(y) < step * 1e-8 ? colors.axis : colors.grid;
    line(context, [0, point[1]], [width, point[1]], rect);
    context.textAlign = 'right';
    if (Math.abs(y) >= step * 1e-8 && point[1] > 24 && point[1] < height - 10) context.fillText(format(y), labelX, point[1] + 3);
  }
  context.font = '600 12px system-ui, sans-serif';
  context.textAlign = 'right';
  context.fillText('x', width - 12, Math.max(20, Math.min(height - 10, origin[1] - 9)));
  context.textAlign = 'left';
  context.fillText('y', Math.max(10, Math.min(width - 18, origin[0] + 10)), 18);
}

function drawField(context, width, height, camera, colors, a, rect) {
  const step = gridStep(38 / camera.scale, 1);
  const xs = ticks(camera.xMin, camera.xMax, step);
  const ys = ticks(camera.yMin, camera.yMax, step);
  const length = Math.min(21, step * camera.scale * 0.56);
  context.strokeStyle = colors.field;
  context.fillStyle = colors.field;
  context.lineWidth = 1;
  for (const x of xs) for (const y of ys) {
    const dx = x * x - y * y + 1;
    const dy = y - x * x - a;
    const norm = Math.hypot(dx, dy);
    if (!Number.isFinite(norm) || norm < 1e-12) continue;
    const center = camera.project([x, y]);
    if (!center) continue;
    const delta = [length * dx / norm, -length * dy / norm];
    const start = center.map((value, i) => value - 0.5 * delta[i]);
    const end = center.map((value, i) => value + 0.5 * delta[i]);
    const segment = clipLine(start, end, { left: 5, right: width - 5, top: 5, bottom: height - 5 });
    if (!segment) continue;
    line(context, segment[0], segment[1], rect);
    head(context, segment[0], segment[1], 4);
  }
}

function drawNullclines(context, width, camera, colors, a, rect) {
  const count = Math.max(180, Math.min(1200, Math.ceil(width * 1.4)));
  const points = sign => Array.from({ length: count + 1 }, (_, index) => {
    const x = camera.xMin + (camera.xMax - camera.xMin) * index / count;
    return [x, sign === 0 ? x * x + a : sign * Math.hypot(x, 1)];
  });
  context.lineWidth = 1.7;
  context.setLineDash([6, 4]);
  context.strokeStyle = colors.xNull;
  polyline(context, points(1), camera.project, rect);
  polyline(context, points(-1), camera.project, rect);
  context.strokeStyle = colors.yNull;
  polyline(context, points(0), camera.project, rect);
  context.setLineDash([]);
}

function equilibrium(context, item, point, colors, width, height) {
  if (!point || point[0] < -8 || point[0] > width + 8 || point[1] < -8 || point[1] > height + 8) return;
  const stable = (item.type || '').startsWith('stable');
  const saddle = item.type === 'saddle';
  const critical = item.type === 'hopf' || item.type === 'saddle-node';
  const color = stable ? colors.attractor : critical ? colors.critical : colors.repeller;
  context.beginPath();
  if (saddle) {
    context.moveTo(point[0], point[1] - 6);
    context.lineTo(point[0] + 6, point[1]);
    context.lineTo(point[0], point[1] + 6);
    context.lineTo(point[0] - 6, point[1]);
    context.closePath();
  } else context.arc(...point, 5, 0, TAU);
  context.fillStyle = stable ? color : colors.background;
  context.fill();
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.stroke();
  if (item.label) {
    context.fillStyle = colors.text;
    context.font = '600 11px system-ui, sans-serif';
    context.textAlign = point[0] > width - 70 ? 'right' : 'left';
    context.fillText(item.label, point[0] + (point[0] > width - 70 ? -10 : 10), Math.max(15, point[1] - 9));
  }
}

export function drawPhase(canvas, options = {}) {
  const size = dimensions(canvas);
  if (!size) return;
  const { context, width, height } = size;
  const colors = palette(options.light);
  const view = camera(width, height, options.view);
  const rect = { left: 0, right: width, top: 0, bottom: height };
  const a = Number.isFinite(options.a) ? options.a : 0;
  context.globalAlpha = 1;
  context.fillStyle = colors.background;
  context.fillRect(0, 0, width, height);
  drawGrid(context, width, height, view, colors, rect);
  if (options.showField !== false) drawField(context, width, height, view, colors, a, rect);
  if (options.showNullclines !== false) drawNullclines(context, width, view, colors, a, rect);
  for (const path of options.paths || []) {
    if (path.kind === 'trajectory' ? options.showTrajectories === false : options.showSeparatrices === false) continue;
    const color = colors[path.kind] || colors.trajectory;
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = path.kind === 'connection' ? 2.8 : 2;
    context.setLineDash([]);
    polyline(context, path.points, view.project, rect, true);
  }
  if (options.showTrajectories !== false) for (const initial of options.initials || []) {
    const point = view.project(initial);
    if (!point || point[0] < 0 || point[0] > width || point[1] < 0 || point[1] > height) continue;
    context.beginPath();
    context.arc(...point, 3.5, 0, TAU);
    context.fillStyle = colors.background;
    context.fill();
    context.strokeStyle = colors.trajectory;
    context.lineWidth = 1.8;
    context.stroke();
  }
  for (const item of options.equilibria || []) equilibrium(context, item, view.project([item.x, item.y]), colors, width, height);
}

export function drawBifurcation(canvas, options = {}) {
  const size = dimensions(canvas);
  if (!size) return;
  const { context, width, height } = size;
  const colors = palette(options.light);
  context.globalAlpha = 1;
  context.fillStyle = colors.background;
  context.fillRect(0, 0, width, height);
  if (width <= DIAGRAM_LEFT + DIAGRAM_RIGHT || height < 100) return;
  const { aMin, aMax } = parameterBounds(options);
  const rect = { left: DIAGRAM_LEFT, right: width - DIAGRAM_RIGHT, top: 41, bottom: height - 35 };
  let extent = 0.5;
  for (const branch of options.branches || []) for (const point of branch.points || []) {
    if (finitePoint(point) && point[0] >= aMin && point[0] <= aMax) extent = Math.max(extent, Math.min(1e100, Math.abs(point[1])));
  }
  extent *= 1.15;
  const horizontal = a => rect.left + (a - aMin) / (aMax - aMin) * (rect.right - rect.left);
  const vertical = x => (rect.top + rect.bottom) / 2 - x / (2 * extent) * (rect.bottom - rect.top);
  const project = point => finitePoint(point) ? [horizontal(point[0]), vertical(point[1])] : null;
  context.font = '10px system-ui, sans-serif';
  context.lineWidth = 1;
  context.setLineDash([]);
  for (const a of ticks(aMin, aMax, gridStep(aMax - aMin, (width - 66) / 65))) {
    const x = horizontal(a);
    context.strokeStyle = colors.grid;
    line(context, [x, rect.top], [x, rect.bottom], rect);
    context.textAlign = 'center';
    context.fillStyle = colors.text;
    context.fillText(format(a), x, height - 18);
  }
  for (const x of ticks(-extent, extent, gridStep(2 * extent, (height - 76) / 44))) {
    const y = vertical(x);
    context.strokeStyle = x === 0 ? colors.axis : colors.grid;
    line(context, [rect.left, y], [rect.right, y], rect);
    context.textAlign = 'right';
    context.fillText(format(x), rect.left - 8, y + 3);
  }
  context.textAlign = 'left';
  context.font = '11px system-ui, sans-serif';
  context.fillText('x', 18, rect.top - 9);
  context.textAlign = 'right';
  context.fillText('a', width - 5, height - 17);
  const rowEnds = [-Infinity, -Infinity];
  const visibleEvents = (options.events || []).filter(event => Number.isFinite(event.value) && event.value >= aMin && event.value <= aMax).sort((a, b) => a.value - b.value);
  for (const event of visibleEvents) {
    const x = horizontal(event.value);
    const color = event.kind === 'homoclinic' || event.kind === 'heteroclinic' ? colors.connection : event.kind === 'hopf' ? colors.critical : colors.text;
    context.strokeStyle = color;
    context.lineWidth = 1;
    context.setLineDash([3, 5]);
    line(context, [x, rect.top], [x, rect.bottom], rect);
    const text = event.shortLabel || ({ homoclinic: 'HC', heteroclinic: 'HeC', hopf: 'H', 'saddle-node': 'SN' }[event.kind] || event.name || '');
    const textWidth = Math.max(16, text.length * 6.5);
    const labelX = Math.max(rect.left + textWidth / 2, Math.min(rect.right - textWidth / 2, x));
    const row = labelX - textWidth / 2 > rowEnds[0] + 5 ? 0 : 1;
    rowEnds[row] = labelX + textWidth / 2;
    context.fillStyle = color;
    context.font = '600 10px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText(text, labelX, row === 0 ? 16 : 31);
  }
  for (const branch of options.branches || []) {
    const stable = (branch.type || '').startsWith('stable');
    context.strokeStyle = stable ? colors.attractor : colors.repeller;
    context.lineWidth = 2;
    context.setLineDash(stable ? [] : [5, 4]);
    polyline(context, branch.points, project, rect);
  }
  if (Number.isFinite(options.a) && options.a >= aMin && options.a <= aMax) {
    const x = horizontal(options.a);
    context.strokeStyle = colors.trajectory;
    context.lineWidth = 1.6;
    context.setLineDash([]);
    line(context, [x, rect.top], [x, rect.bottom], rect);
    context.fillStyle = colors.trajectory;
    context.beginPath();
    context.moveTo(x - 4, rect.bottom + 1);
    context.lineTo(x + 4, rect.bottom + 1);
    context.lineTo(x, rect.bottom - 5);
    context.closePath();
    context.fill();
  }
  context.setLineDash([]);
}
