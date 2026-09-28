import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {HOPF_A} from '../../dist/apps/bifurcations-2d/js/math.js';
import {HETEROCLINIC_A, HOMOCLINIC_A, exactHeteroclinicPoints} from '../../dist/apps/bifurcations-2d/js/connections.js';
import {pickPoint, pickParameter} from '../../dist/apps/bifurcations-2d/js/render.js';

const elements = new Map(), contexts = new Map(), frames = [], resize = [], windowListeners = new Map();
let width = 0, height = 0;
const finite = values => values.forEach(value => {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), 'Canvas geometry must remain finite');
});
function context(id) {
  if (contexts.has(id)) return contexts.get(id);
  const ctx = new Proxy({
    paths: [], arcs: [], texts: [], path: [], dash: [], globalAlpha: 1,
    beginPath() {this.path = []; this.currentArc = null;},
    moveTo(...point) {finite(point); this.path.push(point);},
    lineTo(...point) {finite(point); this.path.push(point);},
    arc(x, y, radius) {finite([x, y, radius]); this.currentArc = {x, y, radius}; this.arcs.push(this.currentArc);},
    fill() {if (this.currentArc) this.currentArc.fill = this.fillStyle;},
    stroke() {
      this.paths.push({points: this.path.slice(), color: this.strokeStyle, width: this.lineWidth, dash: this.dash.slice()});
      if (this.currentArc) this.currentArc.stroke = this.strokeStyle;
    },
    setLineDash(dash) {this.dash = dash;},
    fillText(text, ...values) {finite(values); this.texts.push(String(text));},
    fillRect(...values) {
      finite(values); this.background = this.fillStyle; this.paths = []; this.arcs = []; this.texts = [];
    }
  }, {get: (target, key) => target[key] ?? ((...values) => finite(values))});
  contexts.set(id, ctx);
  return ctx;
}
class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.listeners = new Map();
    this.attributes = {}; this.style = {}; this.value = ''; this.textContent = ''; this.checked = false;
    this.classList = {toggle() {}}; this.captures = new Set();
  }
  set id(value) {this._id = value; elements.set(value, this);}
  get id() {return this._id;}
  get valueAsNumber() {return this.value.trim() === '' ? NaN : Number(this.value);}
  appendChild(child) {this.children.push(child); return child;}
  append(...children) {children.forEach(child => this.appendChild(child));}
  replaceChildren(...children) {this.children = children;}
  addEventListener(type, listener) {this.listeners.set(type, listener);}
  setAttribute(key, value) {this.attributes[key] = String(value);}
  getAttribute(key) {return this.attributes[key] ?? null;}
  removeAttribute(key) {delete this.attributes[key];}
  getBoundingClientRect() {return {width, height, left: 75, top: 60, right: 75 + width, bottom: 60 + height};}
  getContext() {return context(this.id);}
  setPointerCapture(id) {this.captures.add(id);}
  hasPointerCapture(id) {return this.captures.has(id);}
  releasePointerCapture(id) {this.captures.delete(id);}
  focus() {this.focused = true;}
  showModal() {this.open = true;}
  close() {this.open = false;}
}
const page = new URL('../../dist/apps/bifurcations-2d/index.html', import.meta.url);
const html = fs.readFileSync(page, 'utf8');
for (const match of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {
  const [tag, id] = match;
  const element = new Element(tag.match(/^<(\w+)/)[1]); element.id = id;
  element.value = tag.match(/\bvalue="([^"]*)"/)?.[1] ?? '';
  element.checked = /\bchecked\b/.test(tag);
  element.textContent = html.slice(match.index + tag.length).match(/^([^<]*)/)?.[1] ?? '';
}
const $ = id => {assert.ok(elements.has(id), `Missing element ${id}`); return elements.get(id);};
const flush = () => frames.splice(0).forEach(callback => callback(0));
const fireElement = (element, type = 'click', extras = {}) => {
  assert.ok(element.listeners.has(type), `${element.id || element.children[0]?.textContent} has a ${type} handler`);
  element.listeners.get(type)({target: element, preventDefault() {}, ...extras});
};
const fire = (id, type = 'input', value, extras = {}) => {
  const element = $(id); if (value !== undefined) element.value = String(value);
  fireElement(element, type, extras);
};
const phase = () => contexts.get('phase-canvas');
const paths = color => phase().paths.filter(path => path.color === color && path.width >= 2 && path.points.length > 1);
const markers = () => phase().arcs.filter(arc => arc.radius === 3.5);
const count = () => Number($('trajectory-count').textContent.split(' / ')[0]);
const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);
const coordinates = () => [Number($('initial-x').value), Number($('initial-y').value)];
const eventButton = name => {
  const button = $('event-buttons').children.find(child => child.children[0].textContent === name);
  assert.ok(button, `Missing event button ${name}`); return button;
};
const chooseEvent = name => {fireElement(eventButton(name)); flush();};
const pointer = (x, y, pointerId = 1, button = 0) => ({clientX: x + 75, clientY: y + 60, pointerId, button});
const phaseClick = (x, y, button = 0) => {
  fire('phase-canvas', 'pointerdown', undefined, pointer(x, y, 1, button));
  fire('phase-canvas', 'pointerup', undefined, pointer(x, y, 1, button));
};
globalThis.document = {
  documentElement: {dataset: {theme: 'dark'}},
  getElementById: id => elements.get(id) || null,
  createElement: tag => new Element(tag),
  querySelectorAll: selector => selector === '[aria-invalid]' ? [...elements.values()].filter(element => element.getAttribute('aria-invalid') !== null) : []
};
globalThis.window = {addEventListener: (type, listener) => windowListeners.set(type, listener)};
globalThis.devicePixelRatio = 2;
globalThis.requestAnimationFrame = callback => frames.push(callback);
globalThis.ResizeObserver = class {constructor(callback) {resize.push(callback);} observe() {}};
if (process.env.TEST_BIFURCATION_BUNDLE === '1') {
  vm.runInThisContext(fs.readFileSync(new URL('../../dist/apps/bifurcations-2d/js/app.bundle.js', import.meta.url), 'utf8'), {filename: 'bifurcations.bundle.js'});
} else await import('../../dist/apps/bifurcations-2d/js/app.js');

flush();
assert.equal(contexts.size, 0, 'Collapsed canvases wait for layout');
assert.equal($('event-buttons').children.length, 5);
assert.equal($('event-title').textContent, 'Heteroclinic connection');
assert.equal($('equilibrium-count').textContent, '4 equilibria');
assert.equal($('equilibria-table').children.length, 4);
assert.equal(eventButton('Heteroclinic').getAttribute('aria-pressed'), 'true');
width = 800; height = 480; resize.forEach(callback => callback()); flush();
assert.equal(contexts.size, 2);
assert.equal($('phase-canvas').width, 1600);
assert.equal($('bifurcation-canvas').height, 960);
assert.equal(paths('#77c9ef').length, 3, 'The exact connection replaces the corresponding stable half');
assert.equal(paths('#f6b77b').length, 3, 'The exact connection replaces the corresponding unstable half');
assert.equal(paths('#e8a2cf').length, 1);
const connection = paths('#e8a2cf')[0], exact = exactHeteroclinicPoints();
const projectDefault = ([x, y]) => [width / 2 + (x - .1) * height / (2 * 2.65), height / 2 - (y - .5) * height / (2 * 2.65)];
connection.points[0].forEach((value, index) => close(value, projectDefault(exact[0])[index]));
connection.points.at(-1).forEach((value, index) => close(value, projectDefault(exact.at(-1))[index]));

fire('before', 'click'); flush(); close(Number($('parameter').value), HETEROCLINIC_A - .01);
assert.equal(paths('#e8a2cf').length, 0, 'The highlighted connection only appears at its critical parameter');
assert.equal(paths('#77c9ef').length, 4); assert.equal(paths('#f6b77b').length, 4);
assert.match($('event-detail').textContent, /Before selected heteroclinic/);
fire('after', 'click'); flush(); close(Number($('parameter').value), HETEROCLINIC_A + .01);
$('offset').value = '.00001';
fire('after', 'click'); flush(); close(Number($('parameter').value), HETEROCLINIC_A + .00001);
$('offset').value = '0'; fire('before', 'click'); flush();
assert.equal($('offset').getAttribute('aria-invalid'), 'true');
close(Number($('parameter').value), HETEROCLINIC_A + .00001);
fire('at-event', 'click'); flush(); close(Number($('parameter').value), HETEROCLINIC_A);
assert.equal($('offset').getAttribute('aria-invalid'), 'false', 'At value does not require a nonzero comparison offset');
$('offset').value = '.01';

chooseEvent('Homoclinic');
close(Number($('parameter').value), HOMOCLINIC_A);
assert.equal($('event-title').textContent, 'Homoclinic connection');
assert.equal($('equilibrium-count').textContent, '2 equilibria');
assert.match($('event-detail').textContent, /Numerical shooting/);
assert.equal(paths('#77c9ef').length, 1); assert.equal(paths('#f6b77b').length, 1);
const loop = paths('#e8a2cf')[0];
assert.ok(loop.points.length > 500, 'Both accurately shot halves form the visible loop');
loop.points[0].forEach((value, index) => close(value, loop.points.at(-1)[index]));
fire('before', 'click'); flush(); assert.equal(paths('#e8a2cf').length, 0);
fire('at-event', 'click'); flush(); assert.equal(paths('#e8a2cf').length, 1);
chooseEvent('Subcritical Hopf');
close(Number($('parameter').value), HOPF_A);
assert.ok($('equilibria-table').children.some(row => row.children[1].textContent === 'Hopf point'));
fire('before', 'click'); flush();
assert.ok($('equilibria-table').children.some(row => row.children[1].textContent === 'stable focus'));
fire('after', 'click'); flush();
assert.ok($('equilibria-table').children.some(row => row.children[1].textContent === 'unstable focus'));
chooseEvent('Saddle-node · lower'); assert.equal($('equilibrium-count').textContent, '3 equilibria');
fire('before', 'click'); flush(); assert.equal($('equilibrium-count').textContent, '4 equilibria');
fire('after', 'click'); flush(); assert.equal($('equilibrium-count').textContent, '2 equilibria');
chooseEvent('Saddle-node · upper'); assert.equal($('equilibrium-count').textContent, '1 equilibrium');
fire('after', 'click'); flush(); assert.equal($('equilibrium-count').textContent, '0 equilibria');
assert.equal($('equilibria-table').children.length, 1);
assert.match($('equilibria-table').children[0].children[0].textContent, /No real fixed points/);

fire('parameter', 'input', '-0.5000'); flush();
assert.equal($('parameter').value, '-0.5000', 'A valid edit retains the typed representation');
assert.equal($('parameter-value').textContent, 'a = −0.5');
const lastValidSummary = $('parameter-value').textContent;
fire('parameter', 'input', ''); flush();
assert.equal($('parameter-value').textContent, lastValidSummary, 'Incomplete edits keep the previous phase portrait');
fire('parameter', 'change', ''); flush(); assert.equal($('parameter').getAttribute('aria-invalid'), 'true');
for (const value of [-3.1, 1.21, 'not-a-number']) {
  fire('parameter', 'input', value); flush();
  assert.equal($('parameter').getAttribute('aria-invalid'), 'true');
  assert.equal($('parameter-value').textContent, lastValidSummary);
}
fire('parameter-slider', 'input', -.8); flush();
assert.equal($('parameter').value, '-0.8'); assert.equal($('input-error').textContent, '');
close(Number($('bifurcation-canvas').getAttribute('aria-valuenow')), -.8);

chooseEvent('Heteroclinic');
const clicked = pickPoint(275, 320, width, height, {cx: .1, cy: .5, range: 2.65});
phaseClick(275, 320); flush();
assert.equal(count(), 1);
coordinates().forEach((value, index) => close(value, clicked[index], 1e-8));
assert.ok(coordinates().every(value => value < 0), 'Click placement accepts negative coordinates');
assert.equal(paths('#b9a2ff').length, 1); assert.equal(markers().length, 1);
const savedMarker = structuredClone(markers()[0]), savedCoordinates = coordinates();
fire('parameter-slider', 'input', -.5); flush();
assert.deepEqual(coordinates(), savedCoordinates);
assert.deepEqual(markers()[0], savedMarker, 'Changing a preserves the initial point in the same view');
assert.equal(count(), 1);
$('initial-x').value = '-.25'; $('initial-y').value = '1.15';
fire('add-trajectory', 'click'); flush(); assert.equal(count(), 2);
assert.equal(paths('#b9a2ff').length, 2);
$('initial-x').value = ''; fire('add-trajectory', 'click'); flush();
assert.equal(count(), 2); assert.match($('input-error').textContent, /finite initial coordinates/);
$('initial-x').value = '1001'; fire('add-trajectory', 'click'); flush(); assert.equal(count(), 2);
$('initial-x').value = '-.25'; fire('add-trajectory', 'click'); flush(); assert.equal(count(), 3);
assert.equal($('input-error').textContent, '');

const toggleColors = [['show-field', '#3d4942'], ['show-nullclines', '#7f878d'], ['show-separatrices', '#77c9ef'], ['show-trajectories', '#b9a2ff']];
for (const [id, color] of toggleColors) {
  assert.ok(phase().paths.some(path => path.color === color));
  $(id).checked = false; fire(id, 'change'); flush();
  assert.ok(!phase().paths.some(path => path.color === color));
  assert.equal(count(), 3, 'Display changes preserve initial points');
  $(id).checked = true; fire(id, 'change'); flush();
  assert.ok(phase().paths.some(path => path.color === color));
}
$('show-trajectories').checked = false; fire('show-trajectories', 'change');
phaseClick(350, 210); flush();
assert.equal(count(), 4); assert.equal($('show-trajectories').checked, true);

// View changes must not add a trajectory; later clicks use the changed camera.
fire('reset-view', 'click'); flush();
fire('zoom-in', 'click'); flush();
phaseClick(500, 280); flush();
const zoomClicked = pickPoint(500, 280, width, height, {cx: .1, cy: .5, range: 2.65 * .8});
coordinates().forEach((value, index) => close(value, zoomClicked[index], 1e-8));
const countBeforePan = count();
fire('phase-canvas', 'pointerdown', undefined, pointer(400, 240, 4));
fire('phase-canvas', 'pointermove', undefined, pointer(440, 264, 4));
fire('phase-canvas', 'pointerup', undefined, pointer(440, 264, 4)); flush();
assert.equal(count(), countBeforePan, 'Dragging pans without adding a point');
phaseClick(400, 240); flush();
const scale = height / (2 * 2.65 * .8);
close(coordinates()[0], .1 - 40 / scale, 1e-8);
close(coordinates()[1], .5 + 24 / scale, 1e-8);
const countBeforeCancel = count();
fire('phase-canvas', 'pointerdown', undefined, pointer(400, 240, 7));
fire('phase-canvas', 'pointercancel', undefined, pointer(420, 240, 7));
fire('phase-canvas', 'pointerup', undefined, pointer(420, 240, 7));
phaseClick(200, 180, 2); flush(); assert.equal(count(), countBeforeCancel);
fire('phase-canvas', 'keydown', undefined, {key: 'Home'}); flush();
fire('phase-canvas', 'keydown', undefined, {key: '+'});
fire('phase-canvas', 'keydown', undefined, {key: '-'});
fire('phase-canvas', 'wheel', undefined, {deltaY: 180});
fire('zoom-out', 'click'); flush(); assert.equal(count(), countBeforeCancel);

fire('duration', 'change', 1); flush();
const shortPaths = structuredClone(paths('#b9a2ff').map(path => path.points));
for (const bad of ['', 0, 101]) {
  fire('duration', 'change', bad); flush();
  assert.equal($('duration').getAttribute('aria-invalid'), 'true');
  assert.deepEqual(paths('#b9a2ff').map(path => path.points), shortPaths, 'Invalid trace time preserves the previous trajectories');
}
fire('duration', 'change', 4); flush();
assert.equal($('input-error').textContent, '');
assert.notDeepEqual(paths('#b9a2ff').map(path => path.points), shortPaths, 'Valid trace time changes the traced orbit length');
assert.equal(count(), countBeforeCancel);

// The diagram supports dragging and clamped fine/coarse keyboard adjustment.
fire('bifurcation-canvas', 'pointerdown', undefined, pointer(300, 180, 9));
fire('bifurcation-canvas', 'pointermove', undefined, pointer(550, 180, 9));
fire('bifurcation-canvas', 'pointerup', undefined, pointer(550, 180, 9)); flush();
const diagramA = pickParameter(550, width, {aMin: -3, aMax: 1.2});
close(Number($('parameter').value), diagramA);
fire('bifurcation-canvas', 'pointermove', undefined, pointer(600, 180, 9)); flush();
close(Number($('parameter').value), diagramA, 1e-12);
fire('bifurcation-canvas', 'keydown', undefined, {key: 'ArrowRight'}); flush();
close(Number($('parameter').value), diagramA + .01);
fire('bifurcation-canvas', 'keydown', undefined, {key: 'ArrowLeft', shiftKey: true}); flush();
close(Number($('parameter').value), diagramA + .009);
fire('bifurcation-canvas', 'keydown', undefined, {key: 'End'}); flush(); close(Number($('parameter').value), 1.2);
fire('bifurcation-canvas', 'keydown', undefined, {key: 'ArrowUp'}); flush(); close(Number($('parameter').value), 1.2);
fire('bifurcation-canvas', 'keydown', undefined, {key: 'Home'}); flush(); close(Number($('parameter').value), -3);
fire('bifurcation-canvas', 'keydown', undefined, {key: 'ArrowDown'}); flush(); close(Number($('parameter').value), -3);
assert.equal(count(), countBeforeCancel, 'Parameter gestures keep all added initial points');

fire('clear-trajectories', 'click'); flush(); assert.equal(count(), 0);
assert.equal(paths('#b9a2ff').length, 0); assert.equal(markers().length, 0);
$('initial-x').value = '-1'; $('initial-y').value = '1';
for (let i = 0; i < 13; i++) fire('add-trajectory', 'click');
flush(); assert.equal(count(), 12); assert.match($('input-error').textContent, /supports 12/);
fire('clear-trajectories', 'click'); chooseEvent('Homoclinic');
const stateSnapshot = () => ({parameter: $('parameter').value, summary: $('event-title').textContent, count: count(), coordinates: coordinates(), rows: $('equilibria-table').children.map(row => row.children.map(cell => cell.textContent))});
const savedState = stateSnapshot();
const darkConnection = paths('#e8a2cf')[0].points;
document.documentElement.dataset.theme = 'light'; windowListeners.get('themechange')(); flush();
assert.equal(phase().background, '#fafafa');
assert.deepEqual(stateSnapshot(), savedState);
assert.deepEqual(paths('#a83d7d')[0].points, darkConnection, 'Theme changes preserve the computed connection');
document.documentElement.dataset.theme = 'dark'; windowListeners.get('themechange')(); flush();
assert.equal(phase().background, '#141414'); assert.deepEqual(stateSnapshot(), savedState);

fire('guide-button', 'click'); assert.equal($('guide').open, true);
fire('guide', 'click'); assert.equal($('guide').open, false);
const back = html.match(/<a\b[^>]*class="back-link"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/);
assert.ok(back); assert.match(back[0], /Back/); assert.ok(fs.existsSync(new URL(back[1], page)));
fire('duration', 'change', 101); fire('parameter', 'change', '');
fire('reset', 'click'); flush();
close(Number($('parameter').value), HETEROCLINIC_A);
assert.equal(count(), 0); assert.equal($('duration').value, '25');
assert.deepEqual(coordinates(), [-1, 1]);
assert.equal($('input-error').textContent, ''); assert.equal($('load-error').textContent, '');
assert.ok([...elements.values()].every(element => element.getAttribute('aria-invalid') !== 'true'));
assert.equal(paths('#e8a2cf').length, 1);

console.log('Passed: bifurcation startup, accurate connection overlays, event comparisons, parameter validation, fixed initial points, display toggles, pan/zoom placement, trace-time edits, diagram input, themes, guide, Back navigation, and reset.');
