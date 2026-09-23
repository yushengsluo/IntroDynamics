# Intro to nonlinear dynamics and chaos

Interactive illustrations, with a main page linking to each application:

- **Linear flows**: two- and three-dimensional linear differential equations.
- **Forced oscillators**: harmonic motion and the Duffing equation x″ + bx′ + kx + βx³ = cos(ωt), with damping, resonance, nonlinear spring potentials, a chaotic Duffing example, click-to-add trajectories, and time windows within −500…500.
- **Variational equations**: compare 2D/3D nearby trajectories with the moving solution of η′ = Df(x(t))η. Includes linear, nonlinear, and chaotic presets, collections with positive, negative, and zero Lyapunov exponents, paired stable/unstable trajectories for a 3D saddle, click placement, and approximation-error plots.

## Open the examples

Open `dist/index.html` directly in Safari or another modern browser. Keep the entire `dist` folder together so navigation, styles, images, and scripts remain available. All apps include packaged scripts for local `file://` URLs; no browser security changes are needed.

For local development, run this command from the project root:

```sh
python3 scripts/serve.py
```

- Main page: http://127.0.0.1:5173/
- Linear flows: http://127.0.0.1:5173/apps/linear-flows/index.html
- Forced oscillator: http://127.0.0.1:5173/apps/forced-oscillator/index.html
- Variational equations: http://127.0.0.1:5173/apps/variational-equations/index.html

The server disables caching during development. The previous `dynamics.html` URL redirects to the organized application folder, including when opened as a local file.

## Folder structure

```text
DynamicsApp/
├── dist/                          # Complete site; also opens directly in Safari
│   ├── index.html                 # Main page / application directory
│   ├── dynamics.html              # Compatibility link for old bookmarks
│   ├── assets/                    # Main page assets
│   │   ├── css/examples.css
│   │   └── images/                # Application previews
│   └── apps/
│       ├── linear-flows/
│       │   ├── index.html
│       │   ├── css/styles.css
│       │   └── js/                # Source modules, loader, and generated bundle
│       ├── forced-oscillator/
│       │   ├── index.html
│       │   ├── css/styles.css
│       │   └── js/                # Source modules, loader, and generated bundle
│       └── variational-equations/
│           ├── index.html
│           ├── css/styles.css
│           └── js/                # Source modules, loader, and generated bundle
├── scripts/                       # Development and packaging tools
│   ├── serve.py
│   └── build_file_bundle.py
├── tests/
│   ├── navigation.test.mjs         # Links, assets, and module paths
│   ├── linear-flows/              # Application tests
│   ├── forced-oscillator/
│   └── variational-equations/
├── docs/
│   ├── linear-flows.md            # Features and numerical methods
│   ├── forced-oscillator.md
│   └── variational-equations.md
└── README.md
```

`dist` contains the authored site; it is not a disposable build output. Only `app.bundle.js` is generated. Hosting configuration remains in `.openai/hosting.json` and points to `dist`.

## Publish and update with GitHub Desktop

This repository keeps the complete project. GitHub Pages publishes only the contents of `dist`, so the main page and app addresses stay the same as the earlier browser upload.

One-time setup for [IntroDynamics](https://github.com/yushengsluo/IntroDynamics):

1. Open the repository's **Settings → Pages** and select **GitHub Actions** under **Build and deployment → Source**. No template needs to be added: `.github/workflows/pages.yml` is included in this project.
2. In GitHub Desktop, select this local `DynamicsApp` repository and the `main` branch, then click **Push origin** to upload the prepared project history and workflow.
3. Open the repository's **Actions** tab and check that **Test and publish illustrations** completes successfully. If necessary, select that workflow and use **Run workflow** on `main` to 