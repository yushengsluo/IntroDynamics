# Linear flows

The Linear flow illustration visualizes homogeneous autonomous linear systems, **x′ = Ax**, in two and three dimensions.

Open [`dist/apps/linear-flows/index.html`](../dist/apps/linear-flows/index.html), or choose **Linear flows** from the [main page](../dist/index.html). The app header links back to the main page.

## Features


- Signed initial-coordinate inputs accept typed or pasted minus signs and update the portrait while editing.
- Time defaults to −20…20; edit Start t and End t to choose a negative, positive, or mixed interval. Initial conditions remain x(0).
- Editable 2×2 and 3×3 real matrices, plus seven presets per dimension.
- Interactive 2D trace–determinant plane: click or drag to generate a matching phase portrait; enable Follow pointer for live hover updates. Fixed sample points, colors, and the selected trajectory stay unchanged across region boundaries. A persistent tracked pair follows the lower eigenvalue direction, showing convergence to the origin for saddles without adding or removing trajectories at boundaries. The marker tracks matrix edits and presets. Boundary curves and behavior regions are labeled.
- Phase portraits with normalized vector fields and representative trajectories plus up to 40 manually added points.
- Click to add initial conditions in either dimension. In 3D, select a coordinate plane and fixed coordinate; drag or use arrow keys to orbit. A translucent plane and hover preview show placement.
- Defaults sample the equilibrium, real eigendirections, complex invariant planes, generalized modes, and combinations of distinct modes. In 2D, eight compass directions provide coverage before parameter exploration. Each point has a behavior label. Manual points survive matrix edits; Reset representative points restores the examples.
- Playback, restart, scrubbing, speed, time horizon, zoom, and display toggles.
- A periodic cubic grid and vector field extend across the visible 3D volume. Grid and arrow spacing adapt at large scales to keep rendering bounded.
- Solution components over time for any selected trajectory.
- Eigenvalues, trace, determinant, and equilibrium stability classification.
- Responsive layout, keyboard controls, and a built-in guide.
- Feature-detected WebMCP read/configure tools with validated inputs.

## Numerical method and limits

Matrix exponentials use a scaled Taylor series and squaring. Trajectory samples and animated points are evaluated directly from x(0) using the matrix exponential. Negative and positive time are both supported. This handles defective matrices without diagonalization. Automatically generated invariant points evolve within their recorded spectral modes to avoid numerical drift off saddle separatrices; repeated modes use finite polynomial exponentials. Trace–determinant exploration keeps ordinary samples fixed and discards their old spectral modes. Two additional tracked points move continuously with the lower eigenvalue direction; for real eigenvalues they use exact scalar exponential evolution, preventing numerical drift away from the stable saddle direction. In complex regions, the same pair continues as ordinary solution samples. Their count and colors remain constant; editing or deleting a tracked point is respected. Vector arrows are normalized to emphasize direction; their lengths do not encode speed.

Eigenvalues use the quadratic and depressed cubic formulas, with quadratic deflation near a repeated cubic root. Classification checks semisimplicity of zero eigenvalues. Floating-point classification close to zero or repeated eigenvalues is approximate, as with other finite-precision eigensolvers.

Inputs: matrix entries ±20, initial coordinates ±100, time endpoints ±100 with start less than end, representative trajectories plus up to 40 manually added points. Samples are omitted when a component exceeds 100,000 or becomes nonfinite; valid samples on either side remain available. The 3D view uses an orthographic projection. Coefficients are constant, there is no forcing term, and time units are arbitrary. State is local to the current page and resets on reload.

## Application files

All application files live in `dist/apps/linear-flows/`:

- `index.html`: interface, guide, and return link.
- `css/styles.css`: responsive application styles.
- `js/app.js`: controls, plotting, playback, and WebMCP.
- `js/math.js`: numerical algorithms.
- `js/coordinates.js`: signed coordinates and spatial defaults.
- `js/representatives.js`: qualitative examples, tracked directions, and invariant-mode evolution.
- `js/placement.js`: 3D coordinate-plane picking.
- `js/scene.js`: periodic 3D grid and bounded vector-field sampling.
- `js/trace-determinant.js`: parameter-plane drawing and controls.
- `js/boot.js`: loads source modules for HTTP or the classic bundle for local files.
- `js/app.bundle.js`: generated Safari-compatible classic script. Edit source modules instead, then run `python3 scripts/build_file_bundle.py` from the project root.

Application tests are in `tests/linear-flows/`. They cover analytic solutions, representative trajectories, 2D/3D interactions, region-boundary continuity, and both browser loading paths.

The app has no JavaScript dependencies. Google Fonts is optional and falls back to system fonts when unavailable.

The automatic set is finite: it represents behavioral families, not every geometric trajectory or every equilibrium in a continuum. Near coincident eigenvalues and ill-conditioned eigenspaces are subject to floating-point uncertainty.
