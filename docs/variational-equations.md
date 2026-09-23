# Variational equations

Open `dist/apps/variational-equations/index.html`, or use its card on the main page.

For the autonomous system x′ = f(x), the base solution starts at x₀ and each comparison solution starts at y₀. Along the base, the variational equation is

**η′ = Df(x(t))η, η(0) = y₀ − x₀.**

The orange arrow is anchored at the current base point x(t); its tip is x(t) + η(t). It connects the two initial conditions exactly at t = 0. For nonlinear systems this is a first-order prediction of the comparison trajectory, not the exact difference y(t) − x(t). The lower chart shows the actual separation, the variational magnitude, and the approximation error. The Jacobian is evaluated along the base trajectory.

## Examples

- **2D linear:** stable node, saddle, unstable node, contracting spiral, rigid rotation, and shear (the prediction is exact apart from numerical error).
- **2D nonlinear:** damped pendulum, Van der Pol oscillator, unforced double-well Duffing oscillator.
- **3D linear:** spiral with vertical decay, expanding spiral, stable node, neutral rotation, and a hyperbolic saddle with paired stable/unstable comparisons.
- **3D nonlinear:** Lorenz and Rössler systems, using familiar chaotic parameter choices by default. Other parameter values need not be chaotic.

The preset menu includes three Lyapunov collections in each dimension:

| Largest exponent | 2D examples | 3D examples |
| --- | --- | --- |
| Positive | Expanding node | Expanding spiral in 3D |
| Negative | Contracting spiral | Contracting node in 3D |
| Zero | Neutral center and shear with linear separation | Neutral rotation in 3D |

For these linear examples, the page shows the **exact forward-time Lyapunov spectrum** (the real parts of the eigenvalues, including multiplicities), and the largest exponent. The values update with the coefficients and also appear for the original stable node, saddle, and decaying 3D spiral. They do not depend on the base point or the displayed time interval.

A Lyapunov exponent measures the long-time exponential rate of a nonzero variational vector: λ = lim(t → ∞) log(‖η(t)‖ / ‖η(0)‖) / t, when the limit exists. The largest exponent gives the fastest such rate. A vector in a slower invariant direction can have a smaller exponent; for example, a saddle's stable direction contracts although the largest exponent is positive. Zero exponents allow constant separation or polynomial growth: in the shear example η₁(t) = η₁(0) + s t η₂(0), while η₂ is constant. Exponential growth in a linear system is not by itself chaos. The displayed exact spectra are not finite-time numerical estimates for nonlinear presets.

Choose the system dimension, then a preset. Coefficients, the base initial condition, and each comparison initial condition are editable. Up to eight comparison trajectories share the base solution. Ordinary comparisons use violet for the selected trajectory and orange for its selected variational vector. Enable **All variational arrows** to show every vector at once, matching its trajectory color. Other comparison paths remain visible. The separation chart and numerical readouts always describe the selected comparison.

### Stable and unstable trajectories

Under **3D system → Stable and unstable directions**, choose:

- **Hyperbolic flow in 3D:** x′ = ax, y′ = −by, z′ = −cz, with a, b, c > 0. A moving base trajectory is accompanied by a blue comparison offset in the stable yz plane and an orange comparison offset along the unstable x-axis. Both displacements solve the variational equation exactly and are drawn sim