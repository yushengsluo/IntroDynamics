import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {pickPoint} from '../../dist/apps/variational-equations/js/render.js';

const elements = new Map(), contexts = new Map(), frames = [], resize = [], windowListeners = new Map();
let width = 0, height = 0, lightTheme = false;
const finite = values => values.forEach(value => {if (typeof value === 'number') assert.ok(Number.isFinite(value), 'Canvas geometry must remain finite');});
function context(id) {
  if (contexts.has(id)) return contexts.get(id);
  const ctx = new Proxy({
    paths: [], arcs: [], path: [], globalAlpha: 1,
    clearRect() {this.paths = []; this.arcs = [];},
    beginPath() {this.path = []; this.currentArc = null;},
    moveTo(...point) {finite(point); this.path.push(point);},
    lineTo(...point) {finite(point); this.path.push(point);},
    arc(x, y, radius) {finite([x, y, radius]); this.currentArc = {x, y, radius}; this.arcs.push(this.currentArc);},
    fill() {if (this.currentArc) this.currentArc.color = this.fillStyle;},
    stroke(path) {this.paths.push({points: path?.points || this.path.slice(), color: this.strokeStyle, width: this.lineWidth, alpha: this.globalAlpha});},
    fillRect(...values) {finite(values); this.background = this.fillStyle;}
  }, {get: (target, key) => target[key] ?? ((...values) => finite(values))});
  contexts.set(id, ctx);
  return ctx;
}
class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.listeners = new Map(); this.attributes = {}; this.style = {}; this.value = ''; this.textContent = ''; this.checked = false;
    this.classList = {toggle() {}}; this.captures = new Set();
  }
  set id(value) {this._id = value; elements.set(value, this);}
  get id() {return this._id;}
  appendChild(child) {this.children.push(child); return child;}
  replaceChildren(...children) {
    const remove = child => {child.children.forEach(remove); if (child.id && elements.get(child.id) === child) elements.delete(child.id);};
    this.children.forEach(remove); this.children = []; children.forEach(child => this.appendChild(child));
  }
  addEventListener(type, listener) {this.listeners.set(type, listener);}
  setAttribute(key, value) {this.attributes[key] = String(value);}
  getAttribute(key) {return this.attributes[key] ?? null;}
  removeAttribute(key) {delete this.attributes[key];}
  getBoundingClientRect() {return {width, height, left: 75, top: 60, right: 75 + width, bottom: 60 + height};}
  getContext() {return context(this.id);}
  setPointerCapture(id) {this.captures.add(id);}
  hasPointerCapture(id) {return this.captures.has(id);}
  releasePointerCapture(id) {this.captures.delete(id);}
  showModal() {this.open = true;}
  close() {this.open = false;}
}
const page = new URL('../../dist/apps/variational-equations/index.html', import.meta.url);
const html = fs.readFileSync(page, 'utf8');
for (const [tag, id] of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {
  const element = new Element(tag.match(/^<(\w+)/)[1]); element.id = id;
  element.value = tag.match(/\bvalue="([^"]*)"/)?.[1] ?? '';
  element.checked = /\bchecked\b/.test(tag);
}
const $ = id => {assert.ok(elements.has(id), `Missing element ${id}`); return elements.get(id);};
const flush = (timestamp = 0) => frames.splice(0).forEach(callback => callback(timestamp));
const fire = (id, type = 'input', value, extras = {}) => {
  const element = $(id); if (value !== undefined) element.value = String(value);
  assert.ok(element.listeners.has(type), `${id} has a ${type} handler`);
  element.listeners.get(type)({target: element, preventDefault() {}, ...extras});
};
const count = () => Number($('comparison-count').textContent.split(' / ')[0]);
const close = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);
const coordinates = prefix => [0, 1, 2].filter(index => elements.has(`${prefix}-${index}`)).map(index => Number($(`${prefix}-${index}`).value));
const phaseClick = (x, y, button = 0) => {
  const event = {clientX: 75 + x, clientY: 60 + y, pointerId: 1, button};
  fire('phase-canvas', 'pointerdown', undefined, event); fire('phase-canvas', 'pointerup', undefined, event);
};
globalThis.document = {
  getElementById: id => elements.get(id) || null,
  createElement: tag => new Element(tag),
  querySelector: selector => selector === 'input[aria-invalid="true"]' ? [...elements.values()].find(element => element.tagName === 'INPUT' && element.getAttribute('aria-invalid') === 'true') : new Element('main'),
  addEventListener() {}
};
globalThis.window = {AppTheme: {isLight: () => lightTheme}, addEventListener: (type, listener) => windowListeners.set(type, listener)};
globalThis.devicePixelRatio = 2;
globalThis.requestAnimationFrame = callback => frames.push(callback);
globalThis.ResizeObserver = class {constructor(callback) {resize.push(callback);} observe() {}};
globalThis.Path2D = class {
  constructor() {this.points = [];}
  moveTo(...point) {finite(point); this.points.push(point);}
  lineTo(...point) {finite(point); this.points.push(point);}
};
if (process.env.TEST_VARIATIONAL_BUNDLE === '1') vm.runInThisContext(fs.readFileSync(new URL('../../dist/apps/variational-equations/js/app.bundle.js', import.meta.url), 'utf8'), {filename: 'variational.bundle.js'});
else await import('../../dist/apps/variational-equations/js/app.js');

flush();
assert.equal(contexts.size, 0, 'Collapsed canvases wait for layout');
assert.equal($('preset').value, 'pendulum');
assert.equal($('time-label').textContent, 't = 0.00');
assert.equal($('initial-vector').textContent, '(0.3, 0.25)');
assert.equal($('approximation-error').textContent, '0');
width = 800; height = 480; resize.forEach(callback => callback()); flush();
assert.equal(contexts.size, 2);
assert.equal($('phase-canvas').width, 1600, 'The backing canvas follows device pixel ratio');
const phase = () => contexts.get('phase-canvas');
const marker = color => phase().arcs.find(arc => arc.color === color && arc.radius === 5.5);
const vector = () => phase().paths.find(path => path.color === '#f6b77b' && path.width === 2.4);
assert.deepEqual(vector().points[0], [marker('#61dfbd').x, marker('#61dfbd').y], 'The arrow tail is on the base trajectory');
assert.deepEqual(vector().points[1], [marker('#b9a2ff').x, marker('#b9a2ff').y], 'At zero the arrow connects the two initial conditions');

fire('base-0', 'input', -1.25); fire('base-1', 'input', -.2); fire('comparison-0', 'input', -1); flush();
assert.deepEqual(coordinates('base'), [-1.25, -.2]);
assert.equal($('initial-vector').textContent, '(0.25, 0.45)');
assert.equal($('approximation-error').textContent, '0');
const validInitial = $('initial-vector').textContent;
fire('comparison-0', 'input', ''); flush();
assert.equal($('comparison-0').getAttribute('aria-invalid'), 'true');
assert.equal($('initial-vector').textContent, validInitial, 'Incomplete edits preserve the valid initial condition');
fire('comparison-0', 'input', -1001); flush();
assert.equal($('comparison-0').getAttribute('aria-invalid'), 'true');
fire('comparison-0', 'input', '-0.250'); flush();
assert.equal($('comparison-0').value, '-0.250', 'Editing does not replace the typed text');
assert.equal($('input-error').textContent, '');

fire('timeline', 'input', 2.25); flush();
const originalComparison = coordinates('comparison');
const clicked = pickPoint(240, 336, width, height, {dimension: 2, range: 3.5});
phaseClick(240, 336); flush();
assert.equal(count(), 2); assert.equal($('comparison-select').value, '1');
coordinates('comparison').forEach((value, index) => close(value, clicked[index]));
assert.ok(coordinates('comparison').every(value => value < 0));
assert.equal($('time-label').textContent, 't = 2.25', 'Adding a comparison preserves current time');
fire('comparison-select', 'change', 0); flush();
assert.deepEqual(coordinates('comparison'), originalComparison, 'Adding a point preserves the earlier comparison');
phaseClick(200, 200, 2); phaseClick(-5, 200); flush(); assert.equal(count(), 2);
for (let i = 0; i < 9; i++) fire('add-comparison', 'click');
flush(); assert.equal(count(), 8); assert.equal($('add-comparison').disabled, true);
phaseClick(200, 200); flush(); assert.equal(count(), 8); assert.match($('placement-status').textContent, /Up to 8/);
fire('remove-comparison', 'click'); flush(); assert.equal(count(), 7); assert.equal($('add-comparison').disabled, false);
for (let i = 0; i < 8; i++) fire('remove-comparison', 'click');
flush(); assert.equal(count(), 1); assert.equal($('remove-comparison').disabled, true);

fire('preset', 'change', 'stable-node'); flush();
assert.equal($('system-title').textContent, 'Stable node'); assert.equal($('timeline').max, '8');
fire('parameter-a', 'input', 1); fire('timeline', 'input', 2); flush();
assert.ok(Number($('approximation-error').textContent) < 1e-7, 'Linearized prediction is exact for a linear example');
fire('time-start', 'input', -3); fire('time-end', 'input', 4); flush();
assert.equal($('timeline').min, '-3'); assert.equal($('timeline').max, '4');
fire('restart', 'click'); flush(); assert.equal($('time-label').textContent, 't = -3.00');
fire('initial-time', 'click'); flush(); assert.equal($('time-label').textContent, 't = 0.00');
fire('time-end', 'input', -4); flush();
assert.equal($('timeline').max, '4', 'Invalid reversed ranges preserve the valid solution'); assert.match($('input-error').textContent, /start before the end/);
fire('time-end', 'input', 101); flush(); assert.equal($('timeline').max, '4');
fire('time-end', 'input', 4); flush(); assert.equal($('input-error').textContent, '');
fire('timeline', 'input', 1); fire('speed', 'change', 2); fire('play', 'click'); flush(1000); flush(1100);
assert.equal($('time-label').textContent, 't = 1.20'); assert.equal($('play').getAttribute('aria-label'), 'Pause animation');
fire('play', 'click'); flush(); fire('timeline', 'input', 3.95); fire('play', 'click'); flush(1200); flush(1300);
assert.equal($('time-label').textContent, 't = 4.00'); assert.equal($('play').getAttribute('aria-label'), 'Play animation');
fire('play', 'click'); flush(1400); assert.equal($('time-label').textContent, 't = -3.00', 'Playback restarts at the displayed interval start');
fire('play', 'click'); flush();
fire('time-start', 'input', 1); flush(); assert.equal($('initial-time').disabled, true);

fire('dim-3', 'click'); flush();
assert.equal($('preset').value, 'lorenz'); assert.equal($('slice-controls').hidden, false); assert.equal(coordinates('base').length, 3);
const down = {pointerId: 3, button: 0, clientX: 275, clientY: 260};
fire('phase-canvas', 'pointerdown', undefined, down);
fire('phase-canvas', 'pointermove', undefined, {...down, clientX: 305, clientY: 275});
fire('phase-canvas', 'pointerup', undefined, {...down, clientX: 305, clientY: 275}); flush();
assert.equal(count(), 1, 'A 3D drag rotates without adding an initial condition');
fire('slice-axis', 'change', 1); fire('slice-value', 'input', -2); flush();
phaseClick(410, 260); flush(); assert.equal(count(), 2);
close(coordinates('comparison')[1], -2, 0); assert.equal(coordinates('comparison').length, 3);
fire('slice-value', 'input', ''); phaseClick(420, 260); flush(); assert.equal(count(), 2); assert.match($('placement-status').textContent, /Complete the placement/);
fire('slice-value', 'input', -2); fire('preset', 'change', 'spiral-3d'); flush();
fire('timeline', 'input', 3.25); flush();
const stateSnapshot = () => ({time: $('time-label').textContent, base: coordinates('base'), comparison: coordinates('comparison'), selected: $('comparison-select').value, count: count(), actual: $('actual-distance').textContent, variation: $('variation-distance').textContent});
const savedState = stateSnapshot();
const geometry = phase().paths.find(path => path.color === '#61dfbd' && path.width === 2)?.points;
assert.ok(geometry?.length > 100);
lightTheme = true; windowListeners.get('themechange')(); flush();
assert.deepEqual(stateSnapshot(), savedState, 'Theme changes preserve simulation state');
assert.equal(phase().background, '#fafafa');
assert.strictEqual(phase().paths.find(path => path.color === '#087f66' && path.width === 2)?.points, geometry, 'Theme changes retain cached trajectory geometry');
lightTheme = false; windowListeners.get('themechange')(); flush();
assert.equal(phase().background, '#141414');
assert.deepEqual(stateSnapshot(), savedState);

fire('guide-button', 'click'); assert.equal($('guide').open, true);
fire('guide', 'click', undefined, {clientX: 0, clientY: 0}); assert.equal($('guide').open, false);
const back = html.match(/<a\b[^>]*class="back-link"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/);
assert.ok(back); assert.match(back[0], /Back/); assert.ok(fs.existsSync(new URL(back[1], page)));
fire('dim-2', 'click'); flush(); assert.equal($('preset').value, 'pendulum'); assert.equal($('slice-controls').hidden, true);
fire('reset', 'click'); flush(); assert.equal(count(), 1); assert.equal($('time-label').textContent, 't = 0.00'); assert.equal($('load-error').textContent, '');
// Exact spectra follow the selected model and valid coefficient edits.
assert.equal($('lyapunov-summary').hidden, true, 'Nonlinear presets do not inherit an exact linear spectrum');
for (const [id, sign, largest] of [['unstable-node', 'Positive', '+0.6'], ['contracting-spiral', 'Negative', '-0.2'], ['center', 'Zero', '0'], ['shear', 'Zero', '0']]) {
 fire('preset', 'change', id); flush();
 assert.equal($('lyapunov-summary').hidden, false);
 assert.equal($('lyapunov-kind').textContent, sign + ' Lyapunov exponent');
 assert.equal($('lyapunov-largest').textContent, 'λmax = ' + largest);
 assert.ok($('lyapunov-note').textContent.length > 0);
}
fire('preset', 'change', 'unstable-node'); fire('parameter-a', 'input', .8); flush();
assert.equal($('lyapunov-largest').textContent, 'λmax = +0.8');
fire('parameter-a', 'input', ''); flush();
assert.equal($('lyapunov-largest').textContent, 'λmax = +0.8', 'Incomplete coefficient edits preserve the valid spectrum');
fire('dim-3', 'click'); flush();
assert.equal($('lyapunov-summary').hidden, true, 'Switching to Lorenz hides the previous linear spectrum');
for (const [id, sign] of [['expanding-spiral-3d', 'Positive'], ['stable-node-3d', 'Negative'], ['neutral-rotation-3d', 'Zero']]) {
 fire('preset', 'change', id); flush();
 assert.equal($('lyapunov-kind').textContent, sign + ' Lyapunov exponent');
 assert.equal($('lyapunov-summary').hidden, false);
 assert.equal(coordinates('base').length, 3);
 assert.equal($('approximation-error').textContent, '0');
}
fire('preset', 'change', 'spiral-3d'); fire('parameter-a', 'input', 0); flush();
assert.equal($('lyapunov-kind').textContent, 'Zero Lyapunov exponent', 'The label updates at the zero boundary');
assert.equal($('lyapunov-spectrum').textContent, 'Exact spectrum: (0, 0, -0.3)');
fire('parameter-a', 'input', .2); flush();
assert.equal($('lyapunov-kind').textContent, 'Negative Lyapunov exponent');
assert.equal($('lyapunov-spectrum').textContent, 'Exact spectrum: (-0.2, -0.2, -0.3)');
fire('dim-2', 'click'); flush();
assert.equal($('lyapunov-summary').hidden, true);

// Directional examples keep a contracting and expanding comparison together.
const comparisonLabels = () => $('comparison-select').children.map(option => option.textContent);
const directionalArrow = color => phase().paths.find(path => path.color === color && path.width === 2.4);
const selectComparison = index => {fire('comparison-select', 'change', index); flush(); return coordinates('comparison');};
const assertDirectionalPair = () => {
 assert.equal(count(), 2);
 assert.match(comparisonLabels()[0], /\bStable\b/i);
 assert.match(comparisonLabels()[1], /\bUnstable\b/i);
 assert.equal($('show-all-variations').checked, true);
 assert.equal($('stable-legend').hidden, false);
 assert.equal($('unstable-legend').hidden, false);
 assert.ok(directionalArrow('#77c9ef'), 'The stable tangent is visible');
 assert.ok(directionalArrow('#f6b77b'), 'The unstable tangent is visible');
};
fire('dim-3', 'click'); fire('preset', 'change', 'saddle-3d'); flush();
assertDirectionalPair();
assert.equal(coordinates('base').length, 3);
assert.match($('direction-note').textContent, /contract/i);
const stableArrow = structuredClone(directionalArrow('#77c9ef').points);
const unstableArrow = structuredClone(directionalArrow('#f6b77b').points);
selectComparison(1);
assert.deepEqual(directionalArrow('#77c9ef').points, stableArrow, 'Changing the detail selection preserves the stable arrow');
assert.deepEqual(directionalArrow('#f6b77b').points, unstableArrow, 'Changing the detail selection preserves the unstable arrow');
$('show-all-variations').checked = false; fire('show-all-variations', 'change'); flush();
assert.equal(directionalArrow('#77c9ef'), undefined, 'Single-arrow mode only draws the selected variation');
assert.ok(directionalArrow('#f6b77b'));
$('show-all-variations').checked = true; fire('show-all-variations', 'change'); flush();

const stableStart = selectComparison(0);
const stableDistance = Number($('actual-distance').textContent);
const unstableStart = selectComparison(1);
const unstableDistance = Number($('actual-distance').textContent);
fire('timeline', 'input', 1); flush();
assert.ok(Number($('actual-distance').textContent) > unstableDistance, 'The unstable comparison moves away from the moving base');
assert.ok(Number($('approximation-error').textContent) < 1e-7);
selectComparison(0);
assert.ok(Number($('actual-distance').textContent) < stableDistance, 'The stable comparison approaches the moving base');
assert.ok(Number($('approximation-error').textContent) < 1e-7);
fire('initial-time', 'click'); flush();
const previousBaseX = coordinates('base')[0];
fire('base-0', 'input', previousBaseX + .4); flush();
close(coordinates('comparison')[0], stableStart[0] + .4);
close(selectComparison(1)[0], unstableStart[0] + .4);
assert.equal(count(), 2, 'Editing the base reseeds the pair without adding trajectories');

phaseClick(415, 260); flush();
assert.equal(count(), 3, 'Clicking still adds a trajectory alongside the directional pair');
const manualPoint = coordinates('comparison');
const manualIndex = $('comparison-select').value;
fire('parameter-a', 'input', .75); flush();
assert.equal($('comparison-select').value, manualIndex);
assert.deepEqual(coordinates('comparison'), manualPoint, 'Coefficient changes preserve click-added trajectories');
selectComparison(0);
fire('comparison-1', 'input', coordinates('comparison')[1] + .2); flush();
const customStablePoint = coordinates('comparison');
assert.match(comparisonLabels()[0], /\bCustom\b/i, 'An edited seed no longer claims to be the stable comparison');
assert.doesNotMatch(comparisonLabels()[0], /\bStable\b/i);
fire('base-0', 'input', previousBaseX + .8); flush();
assert.deepEqual(coordinates('comparison'), customStablePoint, 'Reseeding never overwrites an edited initial condition');
close(selectComparison(1)[0], unstableStart[0] + .8);
assert.deepEqual(selectComparison(2), manualPoint);
assert.equal(count(), 3);
selectComparison(0); fire('remove-comparison', 'click'); flush();
assert.equal(count(), 2);
assert.match(comparisonLabels()[0], /\bUnstable\b/i, 'Removing a comparison preserves the remaining direction label');
assert.deepEqual(selectComparison(1), manualPoint);
fire('reset', 'click'); flush(); assertDirectionalPair();

fire('preset', 'change', 'lorenz'); flush();
assert.equal(count(), 1, 'The existing chaotic Lorenz preset retains its single comparison');
assert.equal($('stable-legend').hidden, true);
assert.equal($('unstable-legend').hidden, true);
console.log('Passed: variational startup, initial displacement, signed coordinate edits, click placement, comparison lifecycle, playback, 3D placement and rotation, themes, guide, Back navigation, and stable/unstable directional comparison lifecycle.');
