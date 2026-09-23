// Every preset supplies its vector field and exact derivative with respect to state.
function saddleDirectionalComparisons(p, base) {
  if (!Array.isArray(base) || base.length !== 3 || !base.every(Number.isFinite) || ![p.a, p.b, p.c].every(Number.isFinite) || !(p.a > 0 && p.b > 0 && p.c > 0)) return null;
  return {
    comparisons: [
      {point: [base[0], base[1] + 1, base[2] + .75], label: 'Stable direction', kind: 'stable'},
      {point: [base[0] + .35, base[1], base[2]], label: 'Unstable direction', kind: 'unstable'}
    ],
    note: 'The stable displacement lies in the yz plane and contracts. The unstable displacement lies on the x axis and grows. Both variational predictions are exact for this linear flow.'
  };
}

export const presets = [
  {
    id: 'stable-node', name: 'Stable node', group: 'Linear systems', dimension: 2,
    equations: ['x′ = −a x', 'y′ = −c y'],
    base: [2.5, 1.8], comparison: [2.8, 1.4], range: 4, endTime: 8,
    description: 'The variational prediction is exact for a linear system. Both trajectories approach the origin.',
    parameters: [
      {key: 'a', label: 'Decay a', value: .5, min: .05, max: 3, step: .05},
      {key: 'c', label: 'Decay c', value: 1.2, min: .05, max: 3, step: .05}
    ],
    field: (t, [x, y], p) => [-p.a * x, -p.c * y],
    jacobian: (t, x, p) => [[-p.a, 0], [0, -p.c]],
    lyapunov: p => ({exponents: [-p.a, -p.c], note: 'These exact exponents are the decay rates along the two axes. Every displacement contracts.'})
  },
  {
    id: 'saddle', name: 'Saddle', group: 'Linear systems', dimension: 2,
    equations: ['x′ = a x', 'y′ = −c y'],
    base: [0, 2], comparison: [.06, 2.2], range: 4, endTime: 6,
    description: 'The base trajectory lies on the stable axis. A small transverse displacement grows along the unstable axis.',
    parameters: [
      {key: 'a', label: 'Growth a', value: .6, min: .05, max: 3, step: .05},
      {key: 'c', label: 'Decay c', value: .8, min: .05, max: 3, step: .05}
    ],
    field: (t, [x, y], p) => [p.a * x, -p.c * y],
    jacobian: (t, x, p) => [[p.a, 0], [0, -p.c]],
    lyapunov: p => ({exponents: [p.a, -p.c], note: 'The exact largest exponent is positive. A displacement entirely along the stable y-axis instead has the negative exponent −c.'})
  },
  {
    id: 'pendulum', name: 'Damped pendulum', group: 'Nonlinear oscillators', dimension: 2,
    equations: ['θ′ = v', 'v′ = −sin θ − b v'],
    base: [1.8, 0], comparison: [2.1, .25], range: 3.5, endTime: 20,
    description: 'The tangent vector follows the changing slope of the pendulum force along the base motion.',
    parameters: [{key: 'b', label: 'Damping b', value: .15, min: 0, max: 2, step: .05}],
    field: (t, [x, y], p) => [y, -Math.sin(x) - p.b * y],
    jacobian: (t, [x], p) => [[0, 1], [-Math.cos(x), -p.b]]
  },
  {
    id: 'van-der-pol', name: 'Van der Pol oscillator', group: 'Nonlinear oscillators', dimension: 2,
    equations: ['x′ = y', 'y′ = μ(1 − x²)y − x'],
    base: [1.5, .1], comparison: [1.65, .2], range: 4, endTime: 25,
    description: 'Nearby trajectories approach a limit cycle while a displacement along the cycle can persist.',
    parameters: [{key: 'mu', label: 'Nonlinearity μ', value: 1, min: .1, max: 5, step: .1}],
    field: (t, [x, y], p) => [y, p.mu * (1 - x * x) * y - x],
    jacobian: (t, [x, y], p) => [[0, 1], [-1 - 2 * p.mu * x * y, p.mu * (1 - x * x)]]
  },
  {
    id: 'duffing', name: 'Double-well Duffing oscillator', group: 'Nonlinear oscillators', dimension: 2,
    equations: ['x′ = y', 'y′ = x − x³ − b y'],
    base: [.1, .35], comparison: [.16, .4], range: 2.5, endTime: 20,
    description: 'A nonlinear double-well force bends the nearby flow. The tangent prediction is most accurate for small displacements.',
    parameters: [{key: 'b', label: 'Damping b', value: .2, min: 0, max: 2, step: .05}],
    field: (t, [x, y], p) => [y, x - x * x * x - p.b * y],
    jacobian: (t, [x], p) => [[0, 1], [1 - 3 * x * x, -p.b]]
  },
  {
    id: 'spiral-3d', name: 'Spiral with vertical decay', group: 'Linear systems', dimension: 3,
    equations: ['x′ = −a x − ω y', 'y′ = ω x − a y', 'z′ = −c z'],
    base: [2.5, 0, 2], comparison: [2.7, .25, 2.3], range: 4, endTime: 15,
    description: 'Rotation and contraction transport the displacement exactly, in three dimensions.',
    parameters: [
      {key: 'a', label: 'Radial decay a', value: .12, min: 0, max: 2, step: .02},
      {key: 'omega', label: 'Rotation ω', value: 1, min: .1, max: 4, step: .1},
      {key: 'c', label: 'Vertical decay c', value: .3, min: 0, max: 2, step: .05}
    ],
    field: (t, [x, y, z], p) => [-p.a * x - p.omega * y, p.omega * x - p.a * y, -p.c * z],
    jacobian: (t, x, p) => [[-p.a, -p.omega, 0], [p.omega, -p.a, 0], [0, 0, -p.c]],
    lyapunov: p => ({exponents: [-p.a, -p.a, -p.c], note: 'The exact planar exponents are both −a; the vertical exponent is −c. Rotation does not change the exponential rates.'})
  },
  {
    id: 'saddle-3d', name: 'Hyperbolic flow in 3D', group: 'Stable and unstable directions', dimension: 3,
    equations: ['x′ = a x', 'y′ = −b y', 'z′ = −c z'],
    base: [.25, 1.5, 1], comparison: [.25, 2.5, 1.75], range: 5, endTime: 4,
    description: 'A moving hyperbolic trajectory has contracting displacements in the yz plane and an expanding displacement in the x direction. Both comparison trajectories and th