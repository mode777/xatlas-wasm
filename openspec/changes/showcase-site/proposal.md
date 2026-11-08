# Proposal

## Why

`xatlas-wasm` ships a working package and a single-page example, but there is
no public, browser-based showcase that demonstrates what the library actually
does: cut a supplied mesh into charts, pack those charts into an atlas, and
expose the resulting UVs, texel map and utilization. The existing `example/`
renders three canvases for one OBJ, but it has no gallery, worker, build
pipeline, code view or deployment, and it cannot grow into the public demo the
README should link to. This change adds **XW-025**: a separate Vite/TypeScript
showcase site that consumes the already-tested wasm artifact and presents six
unwrap scenarios with 3D, UV, atlas and source views.

## What Changes

- Add a private `site/` Vite + TypeScript app that consumes `xatlas-wasm` from
  the local package (`file:..`), never from the registry, and is not part of the
  npm tarball.
- Add a scenario catalog of six demos: gazebo (upstream MIT asset), cube, UV
  sphere, terrain, packing lab and multi-atlas. Each scenario is a pure module
  with metadata and a `build(context)` that adds its mesh and returns its
  chart/pack options.
- Add a demo page with **3D**, **UV**, **Atlas** and **Code** views: an
  orbitable three.js model with checker/chart/atlas/wireframe modes, a
  chart-colored UV layout, the decoded atlas texel map with sub-atlas selection,
  and the exact demo module source.
- Run unwrapping in a module worker: initialize the module, set the progress
  callback, add the mesh, generate, flatten `getMesh()`/`getImage()` into
  transferable typed arrays, and destroy the atlas.
- Show atlas and mesh statistics — resolution, charts, atlases, utilization,
  texels/unit, input/output counts and duration — plus the scenario's
  chart/pack options.
- Offer OBJ-with-UV and atlas-PNG downloads.
- Add a site validation suite (Vitest) that unwraps every catalog scenario
  against the built artifact and rejects errors, empty or non-finite geometry,
  out-of-range UVs and mismatched image dimensions.
- Add a `site` job to the push/PR build workflow that typechecks, tests and
  builds the site against the freshly built `dist` artifact, including a
  post-build check that the hashed `xatlas.wasm` asset is emitted and
  referenced.
- Add a Pages workflow that deploys the site from the exact
  `xatlas-wasm-dist` artifact a successful main-branch build produced, with
  `SITE_BASE=/xatlas-wasm/`.
- Record XW-025 in `docs/improvements.md`, update the status/sequence, and
  document the site commands in `site/README.md`, `README.md` and `BUILD.md`.

**No package contract changes.** The site consumes the existing separate
`dist/xatlas.wasm` loader contract and does not change it. There is no
`SINGLE_FILE` change, no public API change, no package-layout change and no new
runtime dependency in `xatlas-wasm`. The single-threaded kernel is unchanged.

## Capabilities

### New Capabilities

- `showcase-site`: the public, non-published browser showcase — scenario
  catalog, 3D/UV/atlas/code views, worker unwrapping, statistics, downloads,
  validation and Pages deployment from the tested artifact.

### Modified Capabilities

None.

## Impact

- **New:** `site/` (Vite config, app, scenarios, worker, styles, tests,
  README), `site/package.json` and lockfile, `.github/workflows/pages.yml`.
- **CI:** a site job in `.github/workflows/build-wasm.yml`; no change to the
  wasm build or npm publish path.
- **Docs:** `README.md` live link, `BUILD.md` site commands, `site/README.md`
  authoring contract, `docs/improvements.md` XW-025 and status.
- **Dependencies:** site-only Vite, TypeScript, three.js, highlight.js and
  Vitest; `xatlas-wasm` remains runtime-dependency-free.
- **Package:** unchanged; `site/` and its dependencies are excluded from the
  tarball.
- **Repository settings:** GitHub Pages must be enabled with the Actions
  source; this is a manual prerequisite, not a package change.
- **Deliberately out of scope:** expanding to 10–12 scenarios, section
  filters/coverage manifest, live option sliders and A/B presets, chart
  hover/highlight, UV repack, file upload (depends on XW-006), stress/cancel
  (depends on XW-011/XW-014), in-site documentation (`showcase-docs`) and
  captured thumbnails (`showcase-thumbnails`).
