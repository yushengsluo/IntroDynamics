# Dynamics

Interactive visualization of homogeneous autonomous linear systems, **x′ = Ax**, in two and three dimensions.

## Run locally

No installation or build step is needed. Serve the authored `dist` directory:

```sh
python3 -m http.server 5173 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:5173 in a modern browser. ES modules require an HTTP server instead of opening the HTML file directly.

## Features

- Editable 2×2 and 3×3 real matrices, plus six presets per dimension.
- Phase portraits with normalized vector fields and up to 12 trajectories.
- Click to add 2D initial conditions; drag or use arrow keys to orbit in 3D.
- Playback, restart, scrubbing, speed, time horizon, zoom, and display toggles.
- Solution components over time for any selected trajectory.
- Eigenvalues, trace, determinant, and equilibrium stability classification.
- Responsive layout, keyboard controls, and a built-in guide.
- Feature-detected WebMCP read/configure tools with validated inputs.

## Numerical method and limits

Matrix exponentials use a scaled Taylor series and squaring. Trajectories use the fixed-step exponential propagator, and animated points are evaluated directly at the current time. This handles defective matrices without diagonalization. Vector arrows are normalized to emphasize direction; their lengths do not encode speed.

Eigenvalues use the quadratic and depressed cubic formulas, with quadratic deflation near a repeated cubic root. Classification checks semisimplicity of zero eigenvalues. Floating-point classification close to zero or repeated eigenvalues is approximate, as with other finite-precision eigensolvers.

Inputs: matrix entries ±20, initial coordinates ±100, time horizon 1–30, up to 12 trajectories. Paths stop when a component exceeds 100,000. The 3D view uses an orthographic projection. Coefficients are constant, there is no forcing term, and time units are arbitrary. State is local to the current page and resets on reload.

## Verification

```sh
node tests/math.test.mjs
```

Analytic fixtures cover rotations, Jordan blocks, nilpotent shear, 2D/3D spectra, weak saddles, zero modes, and growth limits. Browser checks cover 2D/3D rendering, playback, presets, input validation, and 390px/1440px layouts. Both WebMCP tools were exercised in a supporting browser, including invalid dimensions and state read-back.

## Source

- `dist/index.html`: interface and guide
- `dist/styles.css`: responsive theme
- `dist/app.js`: controls, plotting, playback, and WebMCP
- `dist/math.js`: numerical algorithms
- `.openai/hosting.json`: Sites identity and static output configuration

The app has no JavaScript dependencies. Google Fonts is optional and falls back to system fonts when unavailable.
