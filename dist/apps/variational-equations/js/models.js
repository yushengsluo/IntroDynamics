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
    description: 'A moving hyperbolic trajectory has contracting displacements in the yz plane and an expanding displacement in the x direction. Both comparison trajectories and their tangent arrows are shown together.',
    parameters: [
      {key: 'a', label: 'Growth a', value: .55, min: .05, max: 2, step: .05},
      {key: 'b', label: 'Decay b', value: .7, min: .05, max: 2, step: .05},
      {key: 'c', label: 'Decay c', value: 1, min: .05, max: 2, step: .05}
    ],
    field: (t, [x, y, z], p) => [p.a * x, -p.b * y, -p.c * z],
    jacobian: (t, x, p) => [[p.a, 0, 0], [0, -p.b, 0], [0, 0, -p.c]],
    directionalComparisons: saddleDirectionalComparisons,
    lyapunov: p => ({exponents: [p.a, -p.b, -p.c], note: 'The exact positive exponent a expands the x direction; the negative exponents −b and −c contract the yz plane. The base trajectory moves, and its linear variational equation has a fixed hyperbolic splitting.'})
  },
  {
    id: 'lorenz', name: 'Lorenz system', group: 'Chaotic systems', dimension: 3,
    equations: ['x′ = σ(y − x)', 'y′ = x(ρ − z) − y', 'z′ = xy − βz'],
    base: [1, 1, 20], comparison: [1.01, 1, 20], range: 30, endTime: 20,
    description: 'Small differences stretch and fold around the attractor. A long tangent vector shows where the local linear approximation breaks down.',
    parameters: [
      {key: 'sigma', label: 'σ', value: 10, min: 1, max: 20, step: .5},
      {key: 'rho', label: 'ρ', value: 28, min: 0, max: 50, step: .5},
      {key: 'beta', label: 'β', value: 8 / 3, min: .5, max: 5, step: .1}
    ],
    field: (t, [x, y, z], p) => [p.sigma * (y - x), x * (p.rho - z) - y, x * y - p.beta * z],
    jacobian: (t, [x, y, z], p) => [[-p.sigma, p.sigma, 0], [p.rho - z, -1, -x], [y, x, -p.beta]]
  },
  {
    id: 'rossler', name: 'Rössler system', group: 'Chaotic systems', dimension: 3,
    equations: ['x′ = −y − z', 'y′ = x + a y', 'z′ = b + z(x − c)'],
    base: [3, 0, .1], comparison: [3.04, .03, .1], range: 16, endTime: 60,
    description: 'A slowly expanding spiral folds back in three dimensions, amplifying a small initial displacement.',
    parameters: [
      {key: 'a', label: 'a', value: .2, min: .05, max: .4, step: .01},
      {key: 'b', label: 'b', value: .2, min: .05, max: .4, step: .01},
      {key: 'c', label: 'c', value: 5.7, min: 2, max: 10, step: .1}
    ],
    field: (t, [x, y, z], p) => [-y - z, x + p.a * y, p.b + z * (x - p.c)],
    jacobian: (t, [x, y, z], p) => [[0, -1, -1], [1, p.a, 0], [z, 0, x - p.c]]
  },
  {
    id: 'unstable-node', name: 'Expanding node', group: 'Positive Lyapunov exponent', dimension: 2,
    equations: ['x′ = a x', 'y′ = c y'],
    base: [.2, .1], comparison: [.24, .16], range: 4, endTime: 5,
    description: 'Both components of the displacement grow exponentially. The faster direction eventually dominates the variational arrow.',
    parameters: [
      {key: 'a', label: 'Growth a', value: .35, min: .05, max: 2, step: .05},
      {key: 'c', label: 'Growth c', value: .6, min: .05, max: 2, step: .05}
    ],
    field: (t, [x, y], p) => [p.a * x, p.c * y],
    jacobian: (t, x, p) => [[p.a, 0], [0, p.c]],
    lyapunov: p => ({exponents: [p.a, p.c], note: 'These exact exponents are the growth rates along the two axes. Exponential separation in this linear system does not imply chaos.'})
  },
  {
    id: 'contracting-spiral', name: 'Contracting spiral', group: 'Negative Lyapunov exponent', dimension: 2,
    equations: ['x′ = −a x − ω y', 'y′ = ω x − a y'],
    base: [2.5, 0], comparison: [2.9, .3], range: 4, endTime: 15,
    description: 'The displacement rotates while its length shrinks at the exact rate e^(−at). Both trajectories approach the origin.',
    parameters: [
      {key: 'a', label: 'Decay a', value: .2, min: .02, max: 2, step: .02},
      {key: 'omega', label: 'Rotation ω', value: 1, min: .1, max: 4, step: .1}
    ],
    field: (t, [x, y], p) => [-p.a * x - p.omega * y, p.omega * x - p.a * y],
    jacobian: (t, x, p) => [[-p.a, -p.omega], [p.omega, -p.a]],
    lyapunov: p => ({exponents: [-p.a, -p.a], note: 'Both exact exponents equal −a. Every nonzero displacement contracts at this rate, regardless of its direction.'})
  },
  {
    id: 'center', name: 'Neutral center', group: 'Zero Lyapunov exponent', dimension: 2,
    equations: ['x′ = −ω y', 'y′ = ω x'],
    base: [2, 0], comparison: [2.4, .25], range: 3.5, endTime: 16,
    description: 'Rigid rotation preserves distances. The variational arrow rotates without growing or shrinking.',
    parameters: [{key: 'omega', label: 'Rotation ω', value: 1, min: .1, max: 4, step: .1}],
    field: (t, [x, y], p) => [-p.omega * y, p.omega * x],
    jacobian: (t, x, p) => [[0, -p.omega], [p.omega, 0]],
    lyapunov: p => ({exponents: [0, 0], note: 'Both exact exponents are zero: the length of every variational displacement stays constant.'})
  },
  {
    id: 'shear', name: 'Shear with linear separation', group: 'Zero Lyapunov exponent', dimension: 2,
    equations: ['x′ = s y', 'y′ = 0'],
    base: [-1, .15], comparison: [-1, .4], range: 3.5, endTime: 12,
    description: 'Different heights travel at different speeds. A vertical displacement produces linear growth of separation, even though the Lyapunov exponents are zero.',
    parameters: [{key: 's', label: 'Shear s', value: .5, min: .05, max: 2, step: .05}],
    field: (t, [x, y], p) => [p.s * y, 0],
    jacobian: (t, x, p) => [[0, p.s], [0, 0]],
    lyapunov: p => ({exponents: [0, 0], note: 'Both exact exponents are zero. Linear growth is subexponential: log(length ratio)/t tends to zero as t increases.'})
  },
  {
    id: 'expanding-spiral-3d', name: 'Expanding spiral in 3D', group: 'Positive Lyapunov exponent', dimension: 3,
    equations: ['x′ = a x − ω y', 'y′ = ω x + a y', 'z′ = c z'],
    base: [.6, 0, .6], comparison: [.7, .1, .8], range: 4.5, endTime: 7,
    description: 'A rotating planar displacement and a vertical displacement both grow exponentially, with independently adjustable rates.',
    parameters: [
      {key: 'a', label: 'Radial growth a', value: .2, min: .02, max: 2, step: .02},
      {key: 'omega', label: 'Rotation ω', value: 1, min: .1, max: 4, step: .1},
      {key: 'c', label: 'Vertical growth c', value: .1, min: .02, max: 2, step: .02}
    ],
    field: (t, [x, y, z], p) => [p.a * x - p.omega * y, p.omega * x + p.a * y, p.c * z],
    jacobian: (t, x, p) => [[p.a, -p.omega, 0], [p.omega, p.a, 0], [0, 0, p.c]],
    lyapunov: p => ({exponents: [p.a, p.a, p.c], note: 'The exact planar exponents are both a; the vertical exponent is c. This linear expansion is not chaotic motion.'})
  },
  {
    id: 'stable-node-3d', name: 'Contracting node in 3D', group: 'Negative Lyapunov exponent', dimension: 3,
    equations: ['x′ = −a x', 'y′ = −b y', 'z′ = −c z'],
    base: [2.5, 2, 1.6], comparison: [2.9, 2.3, 1.9], range: 4, endTime: 12,
    description: 'All three directions contract. The slowest decay with a nonzero displacement component dominates at long times.',
    parameters: [
      {key: 'a', label: 'Decay a', value: .25, min: .05, max: 2, step: .05},
      {key: 'b', label: 'Decay b', value: .4, min: .05, max: 2, step: .05},
      {key: 'c', label: 'Decay c', value: .6, min: .05, max: 2, step: .05}
    ],
    field: (t, [x, y, z], p) => [-p.a * x, -p.b * y, -p.c * z],
    jacobian: (t, x, p) => [[-p.a, 0, 0], [0, -p.b, 0], [0, 0, -p.c]],
    lyapunov: p => ({exponents: [-p.a, -p.b, -p.c], note: 'These exact exponents are the three axial decay rates. Every displacement shrinks exponentially.'})
  },
  {
    id: 'neutral-rotation-3d', name: 'Neutral rotation in 3D', group: 'Zero Lyapunov exponent', dimension: 3,
    equations: ['x′ = −ω y', 'y′ = ω x', 'z′ = 0'],
    base: [2, 0, -.7], comparison: [2.3, .25, .7], range: 4, endTime: 16,
    description: 'Horizontal planes rotate rigidly while height stays fixed. The distance between any two trajectories remains constant.',
    parameters: [{key: 'omega', label: 'Rotation ω', value: 1, min: .1, max: 4, step: .1}],
    field: (t, [x, y, z], p) => [-p.omega * y, p.omega * x, 0],
    jacobian: (t, x, p) => [[0, -p.omega, 0], [p.omega, 0, 0], [0, 0, 0]],
    lyapunov: p => ({exponents: [0, 0, 0], note: 'All three exact exponents are zero. Rotation preserves planar lengths and the vertical separation is constant.'})
  }
];
