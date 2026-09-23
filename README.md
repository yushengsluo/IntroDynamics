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
3. Open the repository's **Actions** tab and check that **Test and publish illustrations** completes successfully. If necessary, select that workflow and use **Run workflow** on `main` to retry after correcting the Pages settings.
4. After the first successful deployment, the main page is available at **https://yushengsluo.github.io/IntroDynamics/**. Use this URL for a full-page embed in Google Sites.

For future updates:

1. Fetch and pull any remote changes before starting edits.
2. Make changes in this folder, rebuild the local-file bundles, and preview and test the app.
3. In GitHub Desktop, review the changes, write a short summary, and choose **Commit to main**.
4. Click **Push origin**. GitHub rebuilds the bundles, runs all tests, and publishes `dist` only after the checks pass. The same website URL continues to work in Google Sites.

The workflow uses Node.js 24 and Python 3.12, without package installation. Pull requests run the same build and tests but do not publish. No personal access token or repository secret is required. If checks fail, inspect the failed step in **Actions**, fix it locally, and push the correction; a failed check does not replace the live site.

## Add another application

1. Create `dist/apps/<app-name>/index.html`, with that application's own `css/` and `js/` folders as needed.
2. Add a card to the `examples-list` in `dist/index.html`, linking to `apps/<app-name>/index.html`. Give its title and description unique IDs. Main-page preview images belong in `dist/assets/images/`.
3. Add a **Back** link in the application with `href="../../index.html"` and reuse the shared header and theme controls.
4. Put its tests in `tests/<app-name>/` and detailed documentation in `docs/<app-name>.md`.
5. For module-based apps, use `js/app.js` as the entry point and a classic `js/boot.js` loader that selects `js/app.bundle.js` for local files. The bundle script discovers these entry points automatically and supports local named imports and exported `const` / `function` declarations.

Use relative paths and explicit `index.html` filenames so links work both over HTTP and when opened directly from disk. Application scripts remain separate from the main page.

## Build and verify

After editing application JavaScript modules, refresh all checked-in local-file bundles:

```sh
python3 scripts/build_file_bundle.py
```

Verify the generated bundle and run all tests:

```sh
python3 scripts/build_file_bundle.py --check
node --test
```

The scripts resolve paths relative to their own location, so they can also be launched from another working directory using an absolute path.

See the [Linear flows documentation](docs/linear-flows.md), [Forced oscillator documentation](docs/forced-oscillator.md), and [Variational equations documentation](docs/variational-equations.md) for features, source modules, and numerical limits. Each app has matching folders under `dist/apps/`, `tests/`, and `docs/`.
