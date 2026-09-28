import { HOPF_A, equilibriaFor, phasePaths, equilibriumBranches } from './math.js';
import { HETEROCLINIC_A, HOMOCLINIC_A, exactHeteroclinicPoints, homoclinicPath } from './connections.js';
import { drawPhase, drawBifurcation, pickPoint, pickParameter } from './render.js';

const $ = id => document.getElementById(id);
const aMin = -3, aMax = 1.2;
const events = [
  {id: 'heteroclinic', value: HETEROCLINIC_A, name: 'Heteroclinic', kind: 'heteroclinic', shortLabel: 'HeC',
    description: 'A straight orbit connects the lower-left saddle to the upper-right saddle in forward time.',
    detail: 'Exact: a = −m − 1/(4m), where m³ − m − 1 = 0. The invariant line is y = mx − 1/(2m).'},
  {id: 'lower-fold', value: -1, name: 'Saddle-node · lower', kind: 'saddle-node', shortLabel: 'SN−',
    description: 'The two lower fixed points meet at (0, −1). Increasing a past −1 removes this saddle and source.',
    detail: 'Exact: a = −1. The upper pair of equilibria remains.'},
  {id: 'homoclinic', value: HOMOCLINIC_A, name: 'Homoclinic', kind: 'homoclinic', shortLabel: 'HC',
    description: 'The upper-right saddle has a loop: its outgoing branch returns along its own stable branch.',
    detail: 'Numerical shooting: a ≈ 0.7228957882244. Matching forward unstable and backward stable branches gives this loop; the displayed halves are joined at a transverse section.'},
  {id: 'hopf', value: HOPF_A, name: 'Subcritical Hopf', kind: 'hopf', shortLabel: 'H',
    description: 'The upper-left equilibrium loses stability. An unstable periodic orbit shrinks into it as a approaches this value from below.',
    detail: 'Exact: a = √5/2 − 1/4, at (−1/2, √5/2). Its linear eigenvalues are purely imaginary.'},
  {id: 'upper-fold', value: 1, name: 'Saddle-node · upper', kind: 'saddle-node', shortLabel: 'SN+',
    description: 'The remaining source and saddle meet at (0, 1). No equilibria remain for a > 1.',
    detail: 'Exact: a = 1. The two upper nullclines are tangent at the collision.'}
];
const phase = $('phase-canvas'), diagram = $('bifurcation-canvas');
const branches = equilibriumBranches(aMin, aMax);
const state = {a: HETEROCLINIC_A, event: events[0], initials: [], duration: 25,
  view: {cx: .1, cy: .5, range: 2.65}, paths: [], equilibria: []};
const eventButtons = new Map();
let pending = false, needsSolve = true;

const formatted = (n, digits = 6) => {
  if (Math.abs(n) < .5 * 10 ** -digits) n = 0;
  return Number(n.toFixed(digits)).toString().replace('-', '−');
};
const at = event => Math.abs(state.a - event.value) < 5e-13;
function setError(message, input) {
  $('input-error').textContent = message;
  if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function schedule(solve = false) {
  needsSolve ||= solve;
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    if (needsSolve) { needsSolve = false; compute(); }
    draw();
  });
}

function compute() {
  state.equilibria = equilibriaFor(state.a);
  const span = Math.max(10, Math.abs(state.view.cx), Math.abs(state.view.cy), state.view.range * 4);
  state.paths = phasePaths(state.a, state.initials, {duration: state.duration, bound: Math.min(2000, span * 3), spacing: Math.min(.15, Math.max(.012, state.view.range / 100))});
  if (at(events[0])) {
    // Replace the two numerically drifting halves by the exact invariant segment.
    state.paths = state.paths.filter(p => !(p.saddle === 'lower-left' && p.kind === 'unstable' && p.side === -1)
      && !(p.saddle === 'upper-right' && p.kind === 'stable' && p.side === 1));
    state.paths.push({kind: 'connection', points: exactHeteroclinicPoints()});
  } else if (at(events[2])) {
    state.paths = state.paths.filter(p => !(p.saddle === 'upper-right' && p.side === 1));
    state.paths.push({kind: 'connection', points: homoclinicPath()});
  }
  updateSummary();
  updateEquilibria();
}

function draw() {
  const light = document.documentElement.dataset.theme === 'light';
  drawPhase(phase, {a: state.a, view: state.view, light, equilibria: state.equilibria,
    paths: state.paths, initials: state.initials, showField: $('show-field').checked,
    showNullclines: $('show-nullclines').checked, showSeparatrices: $('show-separatrices').checked,
    showTrajectories: $('show-trajectories').checked});
  drawBifurcation(diagram, {a: state.a, light, aMin, aMax, branches, events});
}

function updateSummary() {
  const current = events.find(at);
  $('parameter-value').textContent = `a = ${formatted(state.a, 10)}`;
  $('equilibrium-count').textContent = `${state.equilibria.length} ${state.equilibria.length === 1 ? 'equilibrium' : 'equilibria'}`;
  diagram.setAttribute('aria-valuenow', String(state.a));
  diagram.setAttribute('aria-valuetext', `a = ${formatted(state.a, 9)}${current ? `, ${current.name}` : ''}`);
  for (const event of events) eventButtons.get(event.id).setAttribute('aria-pressed', String(event.id === state.event.id));
  if (current) {
    $('event-title').textContent = current.name + (current.kind.includes('clinic') ? ' connection' : ' bifurcation');
    $('event-description').textContent = current.description;
    $('event-detail').textContent = current.detail;
    return;
  }
  let description;
  if (state.a < -1) description = 'Two saddles, one attracting equilibrium, and one repelling equilibrium. Compare the saddle branches as they pass through the heteroclinic value.';
  else if (state.a < HOMOCLINIC_A) description = 'An attracting equilibrium and a saddle remain. As a increases toward the homoclinic value, the inner saddle branches close into a loop.';
  else if (state.a < HOPF_A) description = 'An attracting focus and a saddle coexist with an unstable periodic orbit. The orbit contracts toward the focus as a approaches the subcritical Hopf value.';
  else if (state.a < 1) description = 'A repelling equilibrium and a saddle remain. They approach one another as a increases toward 1.';
  else description = 'The nullclines no longer intersect: this parameter has no equilibria.';
  $('event-title').textContent = state.a < -1 ? 'Four fixed points' : state.a < 1 ? 'Two fixed points' : 'No fixed points';
  $('event-description').textContent = description;
  const difference = state.a - state.event.value;
  $('event-detail').textContent = `${difference < 0 ? 'Before' : 'After'} selected ${state.event.name.toLowerCase()} value by ${formatted(Math.abs(difference), 9)}. Use “At value” to return to the bifurcation.`;
}

function updateEquilibria() {
  const table = $('equilibria-table');
  table.replaceChildren();
  const eigenvalue = n => typeof n === 'number' ? formatted(n, 4)
    : `${formatted(n.re, 4)} ${n.im < 0 ? '−' : '+'} ${formatted(Math.abs(n.im), 4)}i`;
  for (const e of state.equilibria) {
    const row = document.createElement('tr');
    const type = e.type === 'hopf' ? 'Hopf point' : e.type.replaceAll('-', ' ');
    for (const value of [`(${formatted(e.x, 4)}, ${formatted(e.y, 4)})`, type, e.eigenvalues.map(eigenvalue).join(', ')]) {
      const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell);
    }
    table.appendChild(row);
  }
  if (!state.equilibria.length) {
    const row = document.createElement('tr'), cell = document.createElement('td');
    cell.colSpan = 3; cell.textContent = 'No real fixed points at this parameter.'; row.appendChild(cell); table.appendChild(row);
  }
}

function setParameter(value, preserveInput = false) {
  if (!Number.isFinite(value) || value < aMin || value > aMax) {
    setError('Choose a parameter between −3 and 1.2.', $('parameter')); return false;
  }
  state.a = value;
  if (!preserveInput) $('parameter').value = String(value);
  $('parameter-slider').value = String(value);
  setError('', $('parameter'));
  schedule(true);
  return true;
}

function resetView() {
  state.view = state.a > .3 && state.a < 1.1 ? {cx: -.25, cy: 1, range: 1.7} : {cx: .1, cy: .5, range: 2.65};
  schedule(true);
}

for (const event of events) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'event-button';
  button.setAttribute('aria-pressed', 'false');
  const name = document.createElement('span'), value = document.createElement('small');
  name.textContent = event.name; value.textContent = `a ${event.kind.includes('clinic') || event.kind === 'hopf' ? '≈' : '='} ${formatted(event.value, 6)}`;
  button.append(name, value);
  button.addEventListener('click', () => { state.event = event; setParameter(event.value); resetView(); });
  eventButtons.set(event.id, button); $('event-buttons').appendChild(button);
}

$('parameter').addEventListener('input', event => {
  if (event.target.value.trim() === '') return;
  setParameter(event.target.valueAsNumber, true);
});
$('parameter').addEventListener('change', event => setParameter(event.target.valueAsNumber, true));
$('parameter-slider').addEventListener('input', event => setParameter(Number(event.target.value)));
for (const [id, sign] of [['before', -1], ['at-event', 0], ['after', 1]]) $(id).addEventListener('click', () => {
  const delta = $('offset').valueAsNumber;
  if (sign && (!Number.isFinite(delta) || delta < .000001 || delta > .2)) { setError('Choose a comparison offset between 0.000001 and 0.2.', $('offset')); return; }
  setError('', $('offset'));
  setParameter(state.event.value + sign * (sign ? delta : 0));
});
for (const id of ['show-field', 'show-nullclines', 'show-separatrices', 'show-trajectories']) $(id).addEventListener('change', () => schedule());

function addInitial(point) {
  if (!point || !point.every(Number.isFinite) || point.some(n => Math.abs(n) > 1000)) { setError('Use finite initial coordinates between −1000 and 1000.'); return; }
  if (state.initials.length >= 12) { setError('The portrait supports 12 added points. Clear points to start a new collection.'); return; }
  state.initials.push(point);
  $('show-trajectories').checked = true;
  $('initial-x').value = String(Number(point[0].toPrecision(9)));
  $('initial-y').value = String(Number(point[1].toPrecision(9)));
  $('trajectory-count').textContent = `${state.initials.length} / 12`;
  $('placement-status').textContent = `Added initial point (${formatted(point[0], 4)}, ${formatted(point[1], 4)}).`;
  setError(''); schedule(true);
}
$('add-trajectory').addEventListener('click', () => addInitial([$('initial-x').valueAsNumber, $('initial-y').valueAsNumber]));
$('clear-trajectories').addEventListener('click', () => {
  state.initials = []; $('trajectory-count').textContent = '0 / 12';
  $('placement-status').textContent = ''; setError(''); schedule(true);
});
$('duration').addEventListener('change', event => {
  const duration = event.target.valueAsNumber;
  if (!Number.isFinite(duration) || duration < 1 || duration > 100) { setError('Use a trace time from 1 to 100.', event.target); return; }
  state.duration = duration; setError('', event.target); schedule(true);
});

function zoom(factor) {
  state.view.range = Math.max(.1, Math.min(80, state.view.range * factor));
  schedule(true);
}
$('zoom-in').addEventListener('click', () => zoom(.8));
$('zoom-out').addEventListener('click', () => zoom(1.25));
$('reset-view').addEventListener('click', resetView);
phase.addEventListener('wheel', event => { event.preventDefault(); zoom(Math.exp(Math.max(-.3, Math.min(.3, event.deltaY * .001)))); }, {passive: false});
phase.addEventListener('keydown', event => {
  if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(.8); }
  else if (event.key === '-') { event.preventDefault(); zoom(1.25); }
  else if (event.key === 'Home') { event.preventDefault(); resetView(); }
});
let phaseGesture = null;
phase.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  phase.focus({preventScroll: true});
  phaseGesture = {id: event.pointerId, x: event.clientX, y: event.clientY, view: {...state.view}, moved: false};
  phase.setPointerCapture(event.pointerId);
});
phase.addEventListener('pointermove', event => {
  if (!phaseGesture || phaseGesture.id !== event.pointerId) return;
  const dx = event.clientX - phaseGesture.x, dy = event.clientY - phaseGesture.y;
  if (Math.hypot(dx, dy) > 5) phaseGesture.moved = true;
  if (!phaseGesture.moved) return;
  const rect = phase.getBoundingClientRect(), scale = Math.min(rect.width, rect.height) / (2 * phaseGesture.view.range);
  state.view.cx = phaseGesture.view.cx - dx / scale;
  state.view.cy = phaseGesture.view.cy + dy / scale;
  schedule();
});
phase.addEventListener('pointerup', event => {
  if (!phaseGesture || phaseGesture.id !== event.pointerId) return;
  if (!phaseGesture.moved) {
    const rect = phase.getBoundingClientRect();
    addInitial(pickPoint(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height, state.view));
  } else schedule(true);
  phaseGesture = null;
});
phase.addEventListener('pointercancel', () => { phaseGesture = null; schedule(true); });

let diagramPointer = null;
function parameterAt(event) {
  const rect = diagram.getBoundingClientRect();
  const value = pickParameter(event.clientX - rect.left, rect.width, {aMin, aMax});
  if (value !== null) setParameter(value);
}
diagram.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  diagram.focus({preventScroll: true}); diagramPointer = event.pointerId;
  diagram.setPointerCapture(event.pointerId); parameterAt(event);
});
diagram.addEventListener('pointermove', event => { if (diagramPointer === event.pointerId) parameterAt(event); });
diagram.addEventListener('pointerup', event => { if (diagramPointer === event.pointerId) { parameterAt(event); diagramPointer = null; } });
diagram.addEventListener('pointercancel', () => { diagramPointer = null; });
diagram.addEventListener('keydown', event => {
  if (['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
    const sign = ['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 1;
    setParameter(Math.max(aMin, Math.min(aMax, state.a + sign * (event.shiftKey ? .001 : .01))));
  } else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); setParameter(event.key === 'Home' ? aMin : aMax); }
});

$('guide-button').addEventListener('click', () => $('guide').showModal());
$('guide').addEventListener('click', event => { if (event.target === $('guide')) $('guide').close(); });
$('reset').addEventListener('click', () => {
  state.initials = []; state.duration = 25; state.event = events[0];
  $('duration').value = '25'; $('offset').value = '.01'; $('initial-x').value = '-1'; $('initial-y').value = '1';
  $('trajectory-count').textContent = '0 / 12'; $('placement-status').textContent = '';
  for (const id of ['show-field', 'show-nullclines', 'show-separatrices', 'show-trajectories']) $(id).checked = true;
  document.querySelectorAll('[aria-invalid]').forEach(input => input.removeAttribute('aria-invalid'));
  setParameter(HETEROCLINIC_A); resetView();
});
new ResizeObserver(() => schedule()).observe(phase);
new ResizeObserver(() => schedule()).observe(diagram);
window.addEventListener('themechange', () => schedule());
schedule(true);
