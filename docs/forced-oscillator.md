# Forced oscillators: harmonic and Duffing

An interactive illustration with two equation modes, both with unit mass and unit forcing amplitude:

- **Harmonic:** x″ + bx′ + kx = cos(ωt).
- **Duffing:** x″ + bx′ + kx + βx³ = cos(ωt).

Open [`dist/apps/forced-oscillator/index.html`](../dist/apps/forced-oscillator/index.html), or choose **Forced oscillators** on the [main page](../dist/index.html). The header returns to the main page. Both pages also open directly from disk in Safari, with the complete `dist` folder kept together.

## Explore

- Edit damping **b**, stiffness **k**, driving frequency **ω**, and initial position and velocity at **t = 0**.
- Choose **Duffing oscillator** under Equation to add cubic stiffness **β** and allow negative **k**. Hardening, double-well, softening, and chaotic-motion presets select Duffing mode automatically. Switching between equation modes remembers each mode's last coefficients while retaining all initial conditions and the current time window.
- Click inside the **phase portrait** to add a trajectory at that position and velocity. Each point specifies **x(0), x′(0)**. Up to 12 paths share the same coefficients, with stable colors in both the phase portrait and displacement plot. Use **Selected initial condition** to edit one path and follow it in the motion panel and readouts. **Add a copy** provides a keyboard alternative; remove the selected path or keep only it with the adjacent buttons. Hollow circles mark initial conditions even when zero is outside the time window. Adding a path pauses playback and moves to zero, or the nearest endpoint when zero is outside the window.
- Set **Start time** and **End time** anywhere within **−500…500** to choose a negative, positive, or mixed time window. The default is **0…40**. Initial position and velocity remain defined at **t = 0**, even when zero lies outside the window.
- Watch the spring–damper–mass schematic, position–velocity portrait, and displacement graph together. Play, pause, restart, scrub time, or change playback speed.
- Compare displacement with the applied force and the periodic particular response. The phase portrait's normalized arrows show the instantaneous field **(v, cos(ωt) − bv − kx)**; their lengths do not represent speed.
- View periodic amplitude versus driving frequency on a logarithmic scale, with the current frequency marked.
- Try the damped, near-resonant, undamped-beats, exact-resonance, critically damped, and overdamped presets.

In Duffing mode the instantaneous field is **(v, cos(ωt) − bv − kx − βx³)**. The lower plot shows the **unforced spring potential V(x) = kx²/2 + βx⁴/4**, with a marker for the current position. It replaces the linear frequency-response plot and periodic comparison, whose formulas are not generally valid for nonlinear motion. Readouts show the forcing period, mechanical energy **E = v²/2 + V(x)**, and energy change **dE/dt = v cos(ωt) − bv²**.

For positive β and negative k, the unforced potential has two wells at **±√(−k/β)**. For negative β it is unbounded below, so sufficiently large trajectories can escape. The displayed potential excludes the applied force; the instantaneous forced potential would include **−x cos(ωt)**.

Coefficient and initial-value edits preserve the current animation time and playback state. Editing the time window keeps the current time if it lies inside the new bounds, or moves it to the nearest endpoint. Restart, replay, and presets begin at the selected start time. Presets replace the trajectory set and preserve the window, except the chaotic example, which starts at **0…250** with two nearby seeds. Reset restores **0…40** and starts at zero. Empty or invalid edits leave the last valid solution visible; the start must be less than the end. Nothing is saved across reloads.

## Chaotic Duffing example

Choose **Duffing: chaotic motion** to load **b = 0.3, k = −1, β = 0.25, ω = 1.2**, with **(x(0), x′(0)) = (2.6, 0)** and **(2.60001, 0)**. The initial viewing window **0…250** includes the initial transient. Observe irregular switching between the two wells and the separation of trajectories whose initial positions differ by only 10⁻⁵. Both trails and markers animate together; the dots initially overlap because the starting states are so close. Set the end time to 500 for a longer view.

This is a unit-force scaling of **q″ + 0.3q′ − q + q³ = 0.5 cos(1.2t)**, obtained by setting **x = 2q**. The unscaled chaotic example appears in [James Adamson’s University of Bath thesis, equation 6.3](https://purehost.bath.ac.uk/ws/portalfiles/portal/187949017/UnivBath_PhD_2007_J_Adamson.pdf#page=129). The app uses different initial data; an independent fixed-step RK4 calculation of the tangent equations for the chosen seed gave positive finite-time largest Lyapunov estimates after discarding the first 50 time units, at step sizes 0.01, 0.005, and 0.0025. These support the example's chaotic behavior, but are not a precise converged exponent.

## Harmonic numerical method

Near resonance, the model augments the state to **y = (x, v, cos(ωt), sin(ωt))** and computes the exponential of the constant matrix

```text
    0   1   0   0
A = −k −b   1   0
    0   0   0  −ω
    0   0   ω   0
```

Starting from **y(0) = (x₀, v₀, 1, 0)**, this handles exact resonance without a singular particular solution. Where the periodic amplitude is at most 10,000, the model instead separates the periodic response and evolves the remaining homogeneous state with a 2×2 exponential. This avoids cancellation of huge terms when an exactly periodic solution is evaluated far backward in time. Exact zero transients are preserved; merely small transients are not discarded.

Matrix exponentials use a scaled Taylor series and squaring, handling critical damping without division by eigenvalue differences. Sampled paths reuse a one-step exponential and re-anchor directly every 100 steps. Negative and positive portions are sampled independently away from zero, so backward growth cannot contaminate the initial data or forward solution. Animation markers use the exact-time solution rather than interpolating coarse samples. Default plotting samples are capped at 20,000 intervals so the full ±500 range at the highest driving frequency remains usable.

Plot ranges use the actual finite-time trajectory, so they remain finite at undamped resonance. The periodic amplitude is **R = 1 / hypot(k − ω², bω)**, with phase lag **atan2(bω, k − ω²)**. At **b = 0, ω = √k**, no bounded periodic response exists, and that comparison is omitted. For **b = 0** off resonance, the periodic particular solution is not an attracting response: free oscillations persist. Damping classifications refer to the homogeneous transient.

## Duffing numerical method

An adaptive fourth-order Runge–Kutta integrator compares one full step with two half steps, using their difference divided by 15 to estimate local error. Absolute tolerance is **10⁻¹⁰**, relative tolerance **2×10⁻⁸**, and maximum step **0.025**. The accepted solution uses the two half steps. Independent forward and backward trajectories start at t = 0. Cached accepted states and their derivatives support cubic Hermite interpolation for smooth animation and scrubbing without reintegrating each frame.

Each direction is limited to 100,000 attempted steps, a minimum step of 10⁻⁹, and position/velocity magnitudes of 10⁶. If rapid oscillation or growth exceeds a limit, that direction stops and the page explains where the trajectory was truncated. The other direction remains usable. Long-time nonlinear trajectories can be sensitive to initial values and numerical error; their precise distant endpoints should not be treated as exact predictions. At **β = 0, k > 0**, the exact harmonic solver is used instead. Zero or negative k at β = 0 uses the numerical solver.

Background: [Brown University's Duffing tutorial](https://www.cfm.brown.edu/people/dobrush/am34/Mathematica/ch3/duffing.html) describes the nonlinear restoring term and potential; [SciPy's initial-value solver documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve_ivp.html) provides context for adaptive error control. This app has no SciPy dependency.

Solutions and their samples are cached by coefficients, initial condition, and time window. Changing the selected trajectory or playing the animation reuses the integration. Full plot paths are cached in browsers that support Path2D; every trajectory’s bright phase-history trail and current marker advance with time, regardless of selection. The full-window preview stays faint. Range aggregation iterates over samples without using large argument lists.

## Limits and files

The controls cover **0 ≤ b ≤ 10**, **0.1 ≤ k ≤ 25**, **0 ≤ ω ≤ 10**, initial values **−1,000,000…1,000,000**, and time endpoints **−500…500**, with start less than end. Forcing has phase zero at **t = 0**. Damped transients grow backward in time and can magnify floating-point errors; states with either position or velocity exceeding **10¹⁰⁰**, or nonfinite states, are omitted with an explanatory note. Finite portions of the trajectory remain available.

Duffing mode extends linear stiffness to **−10 ≤ k ≤ 25** and adds **−5 ≤ β ≤ 5**. Its numerical limits are given above.

The frequency-response graph shows amplitudes from 0.01 to 1000; values outside that interval are clipped. The motion schematic scales displacement to the trajectory range. Units are arbitrary but consistent.

Files in `dist/apps/forced-oscillator/`:

- `index.html` and `css/styles.css`: interface and responsive layout.
- `js/oscillator.js`: model, sampling, damping classification, and frequency response.
- `js/duffing.js`: adaptive nonlinear integration, cached interpolation, and spring potential.
- `js/app.js`: controls, playback, diagrams, and plots.
- `js/boot.js`: selects modules over HTTP or the classic script for local files.
- `js/app.bundle.js`: generated local-file script; rebuild using `python3 scripts/build_file_bundle.py`.

The app uses browser APIs only, with no external JavaScript or font dependencies. Tests in `tests/forced-oscillator/` verify analytic harmonic and Duffing solutions, energy balance, continuity at resonance and critical damping, input handling, playback, drawing, bounded escape handling, and both script-loading paths.
