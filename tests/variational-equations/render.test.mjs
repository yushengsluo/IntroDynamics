import assert from 'node:assert/strict';
import { drawPhase, drawGrowth, pickPoint } from '../../dist/apps/variational-equations/js/render.js';

function close(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} ≠ ${expected}`);
}

const width = 800;
const height = 600;
const range = 4;
const scale2D = height / (2 * range * 1.14);
const point2D = pickPoint(width / 2 + 2 * scale2D, height / 2 + scale2D, width, height, { dimension: 2, range });
close(point2D[0], 2, '2D horizontal click coordinate');
close(point2D[1], -1, '2D vertical click coordinate');
assert.deepEqual(pickPoint(width / 2, height / 2, width, height, { dimension: 2 }), [0, 0]);
assert.equal(pickPoint(0, 0, 0, 0, {}), null);

for (const yaw of [-0.65, 0.8, 2.1]) {
  for (const pitch of [-0.6, 0.5, 1.0]) {
    for (let axis = 0; axis < 3; axis += 1) {
      const point = [1.3, -0.6, 0.8];
      const scale = height / (2 * range * 1.65);
      const horizontal = Math.cos(yaw) * point[0] - Math.sin(yaw) * point[1];
      const vertical = Math.sin(yaw) * Math.sin(pitch) * point[0] + Math.cos(yaw) * Math.sin(pitch) * point[1] + Math.cos(pitch) * point[2];
      const picked = pickPoint(width / 2 + horizontal * scale, height / 2 - vertical * scale, width, height, {
        dimension: 3, range, yaw, pitch, sliceAxis: ['x', 'y', 'z'][axis], sliceValue: point[axis],
      });
      assert.ok(picked, 'A non-edge-on slice can receive a click');
      point.forEach((coordinate, index) => close(picked[index], coordinate, '3D projection and selected-plane picking agree'));
    }
  }
}
assert.equal(pickPoint(420, 280, width, height, { dimension: 3, yaw: 0.6, pitch: 0, sliceAxis: 'z' }), null, 'An edge-on placement plane does not create an arbitrary point');

function fakeCanvas(w = width, h = height) {
  const strokes = [];
  const texts = [];
  let current = [];
  let dash = [];
  const context = new Proxy({
    globalAlpha: 1,
    beginPath() { current = []; },
    moveTo(x, y) { assert.ok(Number.isFinite(x) && Number.isFinite(y)); current.push([x, y]); },
    lineTo(x, y) { assert.ok(Number.isFinite(x) && Number.isFinite(y)); current.push([x, y]); },
    arc(x, y, radius) { assert.ok([x, y, radius].every(Number.isFinite)); },
    setLineDash(value) { dash = [...value]; },
    stroke() { strokes.push({ color: this.strokeStyle, points: [...current], thickness: this.lineWidth, alpha: this.globalAlpha, dash: [...dash] }); },
    fillText(text) { texts.push(text); },
  }, { get(target, property) { return property in target ? target[property] : () => {}; } });
  return { width: w, height: h, getBoundingClientRect: () => ({ width: w, height: h }), getContext: () => context, strokes, texts };
}

const initial = { t: 0, base: [0.4, 0.3], comparisons: [[1, 0.7], [-0.2, 0.8]], variations: [[0.6, 0.4], [-0.6, 0.5]] };
const later = { t: 1, base: [0.6, 0.7], comparisons: [[1.4, 1.1], [-0.3, 1.2]], variations: [[0.9, 0.5], [-0.9, 0.6]] };
const solution = { samples: [initial, later] };
const canvas = fakeCanvas();
const options = { dimension: 2, range, solution, frame: initial, selected: 1, showField: false, light: true };
assert.deepEqual(drawPhase(canvas, options), { arrowClipped: false, arrowUnavailable: false });
const orange = canvas.strokes.find(stroke => stroke.color === '#a8580c' && stroke.points.length === 2);
assert.ok(orange, 'Variational displacement draws an orange arrow');
close(orange.points[0][0], width / 2 + initial.base[0] * scale2D, 'Arrow starts at the base trajectory');
close(orange.points[1][0], width / 2 + initial.comparisons[1][0] * scale2D, 'At t=0 the unscaled arrow reaches the selected initial condition');
close(orange.points[1][1], height / 2 - initial.comparisons[1][1] * scale2D, 'At t=0 arrow endpoint matches both coordinates');
assert.ok(canvas.strokes.some(stroke => stroke.color === '#7651b7'), 'The selected comparison remains violet at a nonzero index');

const huge = { ...later, variations: [[1e30, 1e30], [-1e30, 1e30]] };
assert.equal(drawPhase(fakeCanvas(), { ...options, frame: huge }).arrowClipped, true);
const missing = { ...later, variations: [null, null], comparisons: [null, null] };
assert.equal(drawPhase(fakeCanvas(), { ...options, frame: missing }).arrowUnavailable, true);
assert.equal(drawPhase(fakeCanvas(0, 0), options).arrowUnavailable, true);
drawGrowth(canvas, { ...options, frame: later });
assert.ok(canvas.texts.includes('distance · log scale'), 'The logarithmic distance scale is explicit');
drawGrowth(fakeCanvas(), { ...options, solution: { samples: [initial, missing] }, frame: missing });
drawGrowth(fakeCanvas(0, 0), options);

const initial3D = { t: 0, base: [0.4, 0.3, 0.2], comparisons: [[0.4, 0.8, 0.2], [1.1, 0.3, 0.2]], variations: [[0, 0.5, 0], [0.7, 0, 0]] };
const later3D = { t: 1, base: [0.4, 0.3, 0.5], comparisons: [[0.4, 0.5, 0.5], [1.8, 0.3, 0.5]], variations: [[0, 0.2, 0], [1.4, 0, 0]] };
const directionalOptions = {
  dimension: 3, range, yaw: 0.6, pitch: 0.5, solution: { samples: [initial3D, later3D] }, frame: initial3D,
  comparisonKinds: ['stable', 'unstable'], showAllVariations: true, showField: false,
};
function project3D(point) {
  const scale = height / (2 * range * 1.65);
  const { yaw, pitch } = directionalOptions;
  return [width / 2 + (Math.cos(yaw) * point[0] - Math.sin(yaw) * point[1]) * scale,
    height / 2 - (Math.sin(yaw) * Math.sin(pitch) * point[0] + Math.cos(yaw) * Math.sin(pitch) * point[1] + Math.cos(pitch) * point[2]) * scale];
}
for (const light of [false, true]) {
  const directionColors = light ? ['#2479a4', '#a8580c'] : ['#77c9ef', '#f6b77b'];
  for (const selected of [0, 1]) {
    const directionalCanvas = fakeCanvas();
    assert.deepEqual(drawPhase(directionalCanvas, { ...directionalOptions, selected, light }), { arrowClipped: false, arrowUnavailable: false });
    const arrows = directionalCanvas.strokes.filter(stroke => stroke.thickness === 2.4);
    assert.equal(arrows.length, 2, 'Both directional arrows are visible at the same time');
    arrows.forEach((stroke, index) => {
      assert.equal(stroke.color, directionColors[index], 'Stable and unstable colors do not depend on selection or theme');
      project3D(initial3D.base).forEach((coordinate, axis) => close(stroke.points[0][axis], coordinate, 'Each arrow starts at the same base point'));
      project3D(initial3D.comparisons[index]).forEach((coordinate, axis) => close(stroke.points[1][axis], coordinate, 'Each initial arrow reaches its own comparison point'));
      const trajectory = directionalCanvas.strokes.find(item => item.color === directionColors[index] && item.thickness === 1.8 && item.points.length > 0);
      assert.ok(trajectory, 'Each directional trajectory uses its corresponding arrow color');
      assert.equal(trajectory.alpha, 0.82, 'Both directional trajectories remain equally prominent');
    });
    const selectedCanvas = fakeCanvas();
    drawPhase(selectedCanvas, { ...directionalOptions, selected, light, showAllVariations: false });
    const selectedArrows = selectedCanvas.strokes.filter(stroke => stroke.thickness === 2.4);
    assert.equal(selectedArrows.length, 1, 'Turning off all variations preserves a single selected arrow');
    assert.equal(selectedArrows[0].color, directionColors[selected], 'A selected directional arrow keeps its fixed color');

    const growth = fakeCanvas();
    drawGrowth(growth, { ...directionalOptions, selected, light });
    const actualAndVariation = growth.strokes.filter(stroke => stroke.thickness === 1.8 && stroke.points.length > 0);
    assert.equal(actualAndVariation.length, 2);
    assert.ok(actualAndVariation.every(stroke => stroke.color === directionColors[selected]), 'Growth curves use the selected direction color');
    assert.deepEqual(actualAndVariation.map(stroke => stroke.dash), [[], [5, 3]], 'Solid and dashed growth curves distinguish actual and variational distances');
  }
}

const missingStable = { ...initial3D, variations: [null, initial3D.variations[1]] };
const survivingCanvas = fakeCanvas();
assert.deepEqual(drawPhase(survivingCanvas, { ...directionalOptions, frame: missingStable }), { arrowClipped: false, arrowUnavailable: true });
const survivingArrows = survivingCanvas.strokes.filter(stroke => stroke.thickness === 2.4);
assert.equal(survivingArrows.length, 1, 'An unavailable variation does not suppress the other arrow');
assert.equal(survivingArrows[0].color, '#f6b77b');
const partiallyClipped = { ...initial3D, variations: [[1e30, 1e30, 1e30], initial3D.variations[1]] };
const clippedCanvas = fakeCanvas();
assert.deepEqual(drawPhase(clippedCanvas, { ...directionalOptions, frame: partiallyClipped }), { arrowClipped: true, arrowUnavailable: false });
assert.equal(clippedCanvas.strokes.filter(stroke => stroke.thickness === 2.4).length, 2, 'Clipping one arrow leaves both valid arrows drawable');
assert.deepEqual(drawPhase(fakeCanvas(), { ...directionalOptions, frame: { ...partiallyClipped, variations: [partiallyClipped.variations[0], null] } }), { arrowClipped: true, arrowUnavailable: true }, 'Clipping and unavailable flags aggregate independently');

const withCustomComparison = sample => ({
  ...sample,
  comparisons: [...sample.comparisons, sample.base.map((value, index) => value + (index === 2 ? 0.5 : 0))],
  variations: [...sample.variations, [0, 0, 0.5]],
});
const customInitial = withCustomComparison(initial3D);
const customLater = withCustomComparison(later3D);
for (const light of [false, true]) {
  const reservedColors = light ? ['#2479a4', '#a8580c'] : ['#77c9ef', '#f6b77b'];
  for (const selected of [0, 1, 2]) {
    const customCanvas = fakeCanvas();
    drawPhase(customCanvas, {
      ...directionalOptions, light, selected, comparisonKinds: ['stable', 'unstable', null],
      frame: customInitial, solution: { samples: [customInitial, customLater] },
    });
    const customArrow = customCanvas.strokes.filter(stroke => stroke.thickness === 2.4)[2];
    assert.ok(customArrow && !reservedColors.includes(customArrow.color), 'Custom trajectories cannot take reserved stable or unstable colors');
    if (selected === 2) assert.equal(customArrow.color, light ? '#7651b7' : '#b9a2ff', 'Selected custom trajectories retain violet');
  }
}
console.log('Passed: 2D/3D placement, initial arrows, simultaneous stable/unstable variations, fixed theme colors, independent clipping/null handling, and logarithmic growth rendering.');
