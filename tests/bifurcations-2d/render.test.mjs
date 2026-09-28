import assert from 'node:assert/strict';
import { drawPhase, drawBifurcation, pickPoint, pickParameter } from '../../dist/apps/bifurcations-2d/js/render.js';

function close(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} ≠ ${expected}`);
}

function fakeCanvas(width = 800, height = 500) {
  const strokes = [];
  const fills = [];
  const texts = [];
  const circles = [];
  const transforms = [];
  let current = [];
  let dash = [];
  const finite = values => assert.ok(values.every(Number.isFinite), 'Canvas receives only finite geometry');
  const context = new Proxy({
    beginPath() { current = []; },
    moveTo(x, y) { finite([x, y]); current.push({ command: 'move', x, y }); },
    lineTo(x, y) { finite([x, y]); current.push({ command: 'line', x, y }); },
    arc(x, y, radius) { finite([x, y, radius]); circles.push({ x, y, radius }); },
    fillRect(...values) { finite(values); },
    fillText(text, x, y) { finite([x, y]); texts.push({ text, x, y }); },
    setLineDash(value) { dash = [...value]; },
    setTransform(...values) { finite(values); transforms.push(values); },
    stroke() { strokes.push({ color: this.strokeStyle, points: [...current], width: this.lineWidth, dash: [...dash] }); },
    fill() { fills.push({ color: this.fillStyle, points: [...current] }); },
  }, { get: (object, key) => key in object ? object[key] : () => {} });
  return { width, height, getContext: () => context, getBoundingClientRect: () => ({ width, height }), strokes, fills, circles, texts, transforms };
}

for (const [width, height] of [[800, 500], [350, 540]]) {
  for (const view of [{ cx: 0, cy: 0, range: 3 }, { cx: 1.4, cy: -2, range: 0.1 }, { cx: -4, cy: 3, range: 100 }]) {
    const point = [view.cx + view.range * 0.6, view.cy - view.range * 0.4];
    const scale = Math.min(width, height) / (2 * view.range);
    const px = width / 2 + (point[0] - view.cx) * scale;
    const py = height / 2 - (point[1] - view.cy) * scale;
    const picked = pickPoint(px, py, width, height, view);
    picked.forEach((value, i) => close(value, point[i], 'Phase picking respects pan, aspect ratio, and zoom'));
  }
}
assert.deepEqual(pickPoint(400, 250, 800, 500, { cx: 1, cy: 2, range: 0 }), [1, 2]);
assert.equal(pickPoint(NaN, 2, 800, 500), null);
assert.equal(pickPoint(2, 2, 0, 500), null);
assert.equal(pickPoint(2, 2, 800, Infinity), null);

for (const width of [350, 800]) {
  const aMin = -1.5;
  const aMax = 2;
  for (const a of [-1.5, -1, 0, 0.68, 2]) {
    const px = 48 + (a - aMin) / (aMax - aMin) * (width - 66);
    close(pickParameter(px, width, { aMin, aMax }), a, 'Parameter picking inverts diagram position');
  }
  assert.equal(pickParameter(-100, width, { aMin, aMax }), aMin);
  assert.equal(pickParameter(width + 100, width, { aMin, aMax }), aMax);
}
assert.equal(pickParameter(40, 0), null);
assert.equal(pickParameter(NaN, 800), null);

const view = { cx: 0.5, cy: 0, range: 3 };
const baseOptions = { a: 0.4, view, showField: false, showNullclines: false };
for (const light of [false, true]) {
  const colors = light
    ? { stable: '#2479a4', unstable: '#a8580c', trajectory: '#7651b7', connection: '#a83d7d' }
    : { stable: '#77c9ef', unstable: '#f6b77b', trajectory: '#b9a2ff', connection: '#e8a2cf' };
  const paths = Object.keys(colors).map((kind, i) => ({ kind, points: [[-1, i - 1.5], [0, i - 1.5], [1, i - 1.5], [2, i - 1.5]] }));
  const canvas = fakeCanvas();
  drawPhase(canvas, { ...baseOptions, light, paths, initials: [[-1, -1.5]] });
  for (const [kind, color] of Object.entries(colors)) {
    assert.ok(canvas.strokes.some(stroke => stroke.color === color && stroke.points.length >= 4), `${kind} path is shown in both themes`);
    const arrows = canvas.fills.filter(fill => fill.color === color && fill.points.length === 3);
    assert.ok(arrows.length, `${kind} path has flow arrows`);
    assert.ok(arrows.every(arrow => arrow.points[0].x > arrow.points[1].x && arrow.points[0].x > arrow.points[2].x), 'Arrows follow forward-time point order');
  }
  const hidden = fakeCanvas();
  drawPhase(hidden, { ...baseOptions, light, paths, showSeparatrices: false, showTrajectories: false });
  assert.ok(!hidden.strokes.some(stroke => Object.values(colors).includes(stroke.color)), 'Visibility controls suppress both paths and their arrows');
}

const nullclines = fakeCanvas();
drawPhase(nullclines, { ...baseOptions, showNullclines: true });
const coolGray = nullclines.strokes.filter(stroke => stroke.color === '#7f878d');
const warmGray = nullclines.strokes.filter(stroke => stroke.color === '#96918a');
assert.equal(coolGray.length, 2, 'Both branches of x′=0 are rendered');
assert.equal(warmGray.length, 1, 'The y′=0 parabola is rendered');
for (const stroke of [...coolGray, ...warmGray]) {
  assert.equal(stroke.points.filter(point => point.command === 'move').length, 1, 'A connected nullcline preserves its dash phase across sampled points');
}
for (const [strokes, equation] of [[coolGray, (x, y) => x * x - y * y + 1], [warmGray, (x, y) => y - x * x - baseOptions.a]]) {
  let checked = 0;
  for (const stroke of strokes) for (const point of stroke.points) {
    if (point.x <= 1 || point.x >= 799 || point.y <= 1 || point.y >= 499) continue;
    const [x, y] = pickPoint(point.x, point.y, 800, 500, view);
    assert.ok(Math.abs(equation(x, y)) < 1e-9, 'Interior nullcline points satisfy their defining differential equation');
    checked += 1;
  }
  assert.ok(checked > 30, 'Nullclines are sampled across the viewport');
}

const guarded = fakeCanvas();
drawPhase(guarded, {
  ...baseOptions,
  paths: [
    { kind: 'trajectory', points: [[-1e100, 0], [1e100, 0], null, [NaN, 1], [1, 1], [2, 2]] },
    { kind: 'stable', points: [[0, 0], [Infinity, 1], [1, 1], [2, 1]] },
  ],
  equilibria: [{ x: 0, y: 0, type: 'stable-focus' }, { x: 1, y: 1, type: 'saddle' }, { x: NaN, y: 0, type: 'saddle' }],
  initials: [[Infinity, 1]],
});
for (const stroke of guarded.strokes) for (const point of stroke.points) {
  assert.ok(point.x >= 0 && point.x <= 800 && point.y >= 0 && point.y <= 500, 'Divergent path segments are clipped to the viewport');
}
drawPhase(fakeCanvas(0, 0), baseOptions);
drawPhase(fakeCanvas(), { view: { cx: NaN, cy: Infinity, range: 0 }, a: NaN, paths: [{ points: [null] }] });

const events = [
  { value: -1, kind: 'saddle-node', shortLabel: 'SN' },
  { value: 0.68, kind: 'hopf', shortLabel: 'H' },
  { value: 0.7, kind: 'homoclinic', shortLabel: 'HC' },
  { value: 1, kind: 'heteroclinic', shortLabel: 'HeC' },
];
for (const light of [false, true]) {
  const diagram = fakeCanvas(800, 300);
  drawBifurcation(diagram, {
    a: 0.4, light, aMin: -2, aMax: 2, events,
    branches: [
      { type: 'stable-focus', points: [[-2, -2], [0, -1], [2, 0]] },
      { type: 'saddle', points: [[-2, 2], [0, 1], [2, 0]] },
      { type: 'unstable-node', points: [[-2, 1], null, [NaN, 0], [0, 1], [2, 2]] },
    ],
  });
  const stable = diagram.strokes.find(stroke => stroke.color === (light ? '#087f66' : '#61dfbd'));
  const saddle = diagram.strokes.find(stroke => stroke.color === (light ? '#b64655' : '#ef8797'));
  assert.deepEqual(stable.dash, [], 'Stable branches are solid');
  assert.deepEqual(saddle.dash, [5, 4], 'Non-attracting branches are dashed');
  const selected = diagram.strokes.find(stroke => stroke.color === (light ? '#7651b7' : '#b9a2ff'));
  close(pickParameter(selected.points[0].x, 800, { aMin: -2, aMax: 2 }), 0.4, 'Highlighted parameter and picking use the same transform');
  const hopfLabel = diagram.texts.find(item => item.text === 'H');
  const homoclinicLabel = diagram.texts.find(item => item.text === 'HC');
  assert.notEqual(hopfLabel.y, homoclinicLabel.y, 'Nearby critical values use separate label rows');
}
drawBifurcation(fakeCanvas(0, 0));
drawBifurcation(fakeCanvas(40, 60));
drawBifurcation(fakeCanvas(), { a: NaN, aMin: Infinity, aMax: -Infinity, events: [{ value: NaN }], branches: [{ points: [[NaN, Infinity], null] }] });

const denseBranch = fakeCanvas(800, 300);
drawBifurcation(denseBranch, {
  aMin: -2, aMax: 2,
  branches: [{ type: 'saddle', points: Array.from({ length: 101 }, (_, i) => [-1 + i / 50, 0.5 + i / 1000]) }],
});
const dashed = denseBranch.strokes.find(stroke => stroke.color === '#ef8797');
assert.deepEqual(dashed.dash, [5, 4]);
assert.equal(dashed.points.filter(point => point.command === 'move').length, 1, 'Dense equilibrium samples form one subpath, so short segments cannot restart dashes and appear solid');
assert.equal(dashed.points.filter(point => point.command === 'line').length, 100, 'The connected branch still includes every sampled segment');

for (const points of [
  [[-2, 0], [-1, 0.2], [0, 0.5], null, [0, 0.5], [1, 0.2], [2, 0]],
  [[-2, 0], [0, 0], [10, 0], [11, 0], [0, 0.5]],
]) {
  const splitBranch = fakeCanvas(800, 300);
  drawBifurcation(splitBranch, { aMin: -2, aMax: 2, branches: [{ type: 'saddle', points }] });
  const path = splitBranch.strokes.find(stroke => stroke.color === '#ef8797');
  assert.equal(path.points.filter(point => point.command === 'move').length, 2, 'Missing samples and offscreen gaps begin separate subpaths instead of connecting unrelated pieces');
}
console.log('2D bifurcation rendering checks passed.');
