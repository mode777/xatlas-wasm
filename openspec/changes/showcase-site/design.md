# Design

## Context

See `proposal.md` for motivation. The current state that shapes this design:

- `example/` is a single-page, no-build demo. It imports
  `../dist/index.mjs`, parses `thirdparty/xatlas/models/gazebo.obj`, and draws a
  3D wireframe, a UV chart map and an atlas texel map on three 2D canvases.
- The package already ships the separate-artifact loader: `dist/index.mjs`
  resolves `dist/xatlas.wasm` with `new URL('xatlas.wasm', import.meta.url)`
  (XW-001/XW-002), runs in web, Node and worker environments (XW-003), and
  `getImage()` returns a copied texel map (XW-008).
- `scripts/test-package.mjs` already builds a Vite consumer and asserts that a
  `.wasm` asset is emitted. That is the evidence that the default loader can
  survive a production bundler; the showcase must preserve it.
- The reference site in `~/workspace/libfive-wasm/site/` is a Vite + TypeScript
  gallery with a worker, a three.js viewport, a code tab, docs and thumbnails.
  Its architecture is the model, but its demo unit is generative
  (`build(libfive) => Shape`), while xatlas transforms a supplied mesh.
- Measured audit numbers: separate glue plus WASM gzip to 75.4 KB (6.6 KB glue
  + 68.8 KB WASM) versus 102.7 KB for the old single-file bundle. The site
  therefore has a modest asset budget and no reason to embed anything itself.

## Goals / Non-Goals

**Goals:**

- A public showcase that makes charts, seams, packing and texel utilization
  visible for six representative meshes.
- A scenario contract that is pure enough to test in Node and honest enough to
  display as the Code tab.
- One worker path that owns all wasm objects, flattens results once, and
  releases the atlas deterministically.
- A production build that loads its hashed `xatlas.wasm` through the package's
  default loader under the Pages base path.
- CI evidence on every push/PR and a deployment that consumes the tested
  artifact.

**Non-Goals:**

- Changing the package API, loader, wasm build or `SINGLE_FILE` decision.
- A live option editor, A/B runs, chart hover/highlight, UV repack, file
  upload, a stress/cancel scenario, in-site documentation or thumbnails.
- Copying the libfive site implementation. The architecture is reused; the code
  is written for xatlas and for this repository's MIT package.

## Decisions

### D1 — A separate `site/` app, not an extension of `example/`

Add `site/` as a private Vite + TypeScript application with its own
`package.json` and lockfile. It depends on `xatlas-wasm` via `file:..`, never on
the registry, and is excluded from the published package. Keep `example/` as
the zero-build "smallest integration" and link to it from the site README.

Alternatives considered:

- **Extend `example/`.** Rejected: it has no build, worker, routing, tests or
  deployment, and adding Vite to the documented no-build example would break
  its purpose.
- **Add the site to the package.** Rejected: the package must stay small,
  runtime-dependency-free and free of a Vite/three.js toolchain.

The site is a developer tool, not a package consumer target. It can require
Node >= 20 for Vite/TypeScript while `xatlas-wasm` remains Node >= 16.

### D2 — Demo unit is a scenario, not a shape builder

Each scenario module exports metadata and a `build(context)` function. The
worker owns the atlas and passes a small context:

```ts
interface DemoContext {
    xatlas: XAtlasModule;
    atlas: XAtlas;
    addMesh(options: MeshDeclOptions): void;   // throws on non-Success
    addUvMesh(options: UvMeshDeclOptions): void; // reserved for repack
}

interface DemoInput {
    kind: 'mesh' | 'uv';
    positions?: Float32Array;
    indices: Uint32Array;
    normals?: Float32Array;
    uvs?: Float32Array;
}

interface DemoDefinition {
    meta: DemoMeta;
    chartOptions?: ChartOptions;
    packOptions?: PackOptions;
    build(context: DemoContext): DemoInput;
}
```

The worker creates the atlas, sets the progress callback, calls `build`, then
`generate(chartOptions, packOptions)`. The scenario owns the calls that add the
mesh, so the Code tab shows real xatlas usage rather than a generated snippet.
The context helper converts a non-`Success` `addMesh`/`addUvMesh` result into an
error naming the code, so every scenario reports failures consistently.

Demo modules SHALL NOT import three.js, the DOM, Vite-only `?raw` modules or
browser APIs. That keeps them importable by the Node validation suite. The
gazebo OBJ is checked in as a string module copied from the MIT-licensed
upstream model, with attribution; procedural scenarios generate their own
positions and indices in TypeScript.

Alternatives considered:

- **Model gallery with fixed results.** Rejected: it hides the options that
  make xatlas interesting.
- **Live workbench with sliders in this change.** Rejected as scope creep; the
  scenario contract leaves room for presets later.
- **Load OBJ/glTF assets at runtime.** Rejected: it adds network failure modes,
  licensing questions and a Vite `?raw`/`?url` split between the worker and the
  Node tests. Embedding one 36 KB MIT asset is simpler.

### D3 — Worker owns the module, atlas and flattening

The main thread never touches wasm objects. A single module worker handles
requests serially:

```text
main thread                          worker
-----------                          ------
run(scenarioId)  ---------------->   createXAtlas()
                                     atlas = createAtlas()
                                     setProgressCallback -> progress messages
                                     demo.build({ xatlas, atlas, addMesh })
                                     atlas.generate(chartOptions, packOptions)
                                     getMesh(0), getImage()
                                     flatten:
                                       positions[i] = input.positions[xref]
                                       uvs[i] = vertex.uv / width,height
                                       chartIds[i] = vertex.chartIndex
                                       atlasIds[i] = vertex.atlasIndex
                                       indices = mesh.indices
                                       stats + chart metadata
                                     atlas.destroy()
result + transferables <---------    postMessage
```

Flattening is deliberately done in the worker:

- `getMesh()` returns an array of vertex objects (`atlasIndex`, `chartIndex`,
  `uv`, `xref`). Structured-cloning that array is slower and larger than four
  flat typed arrays.
- The main thread can hand the arrays directly to three.js or a 2D canvas.
- `getImage().data` is already a copied `Uint32Array`; it is transferred as the
  raw texel bitfield and decoded on demand for the selected sub-atlas.

The worker destroys the atlas in a `finally` block after copying results. This
avoids depending on the pending lifecycle safety net (XW-007), keeps repeat
runs clean, and means downloads and view switches work from copies rather than
live wasm memory. The design intentionally does not keep an atlas alive for
`getImage()` calls after the run.

Progress messages are separate from request responses and carry the request id,
category string and percentage. The main thread throttles rendering to one
update per animation frame.

Alternative considered: read `getMesh()` on the main thread. Rejected because
the wasm object would have to cross the worker boundary or remain alive, both
worse than flattening once.

### D4 — Three.js for 3D, Canvas 2D for UV and atlas

The 3D view is a new three.js implementation with `OrbitControls`, soft studio
lighting, a resize observer and a framed camera. It consumes the flattened
arrays as a `BufferGeometry` with position, UV, index, chart-id and atlas-id
attributes.

Display modes:

- **Shaded:** neutral material for shape readability.
- **Checker:** a small procedural checker `DataTexture` sampled through the
  generated normalized UVs; this makes distortion and seams visible.
- **Charts:** flat per-chart colors from a deterministic palette; all three
  vertices of a triangle share a chart id, so the color is flat per chart.
- **Atlas texture:** the decoded RGBA image for the selected sub-atlas, with
  faces from other sub-atlases rendered neutrally or hidden.
- **Wireframe:** a line overlay toggle without rebuilding geometry.

The UV view is a 2D canvas: it draws each output triangle in its chart color,
the atlas border, and the selected sub-atlas. The Atlas view is a 2D canvas
that decodes the raw bitfield with `decodeImagePixel` and colors chart texels,
padding, bilinear texels and empty space distinctly, with a legend. Both views
share the sub-atlas selector.

Alternatives considered:

- **Keep the example's canvas 3D wireframe.** Rejected: no textures, no orbit
  quality, no chart-color mode, and it would not show the result the way a
  texture author sees it.
- **Render UV/atlas with three.js.** Rejected: 2D canvas is simpler, crisp for
  lines and texels, and avoids a second WebGL context.

No code is copied from the libfive site (MPL-2.0). The viewport is a smaller,
xatlas-specific implementation.

### D5 — Use the package's default loader and prove it in the build

The site relies on the package's existing `new URL('xatlas.wasm',
import.meta.url)` loader. Vite config:

```ts
base: process.env.SITE_BASE ?? '/',
worker: { format: 'es' },
optimizeDeps: { exclude: ['xatlas-wasm'] },
server: { fs: { allow: ['..'] } },
build: { target: 'es2022', outDir: 'dist', emptyOutDir: true }
```

`optimizeDeps.exclude` prevents Vite's dependency pre-bundling from rewriting
`import.meta.url` to a `.vite/deps` URL. `server.fs.allow` lets dev mode serve
the sibling `dist/xatlas.wasm` from the linked package. The production build
must emit a hashed `.wasm` asset; `site/scripts/check-build.mjs` scans
`site/dist` after the build and fails if no `.wasm` file exists or if the
JavaScript bundle does not reference it.

The site job builds with `SITE_BASE=/xatlas-wasm/`, so the same check covers the
Pages base path. If the asset is not emitted, the fix is a Vite/build-config
fix or a package-level subpath export, not a custom `locateFile` that hides the
asset from bundlers. Changing the loader contract would be a separate package
change.

### D6 — CI validates on push/PR; Pages deploys from the tested artifact

Add a `site` job to `.github/workflows/build-wasm.yml`:

```text
build (existing) --upload xatlas-wasm-dist--> site (new)
                                               download same-run artifact
                                               npm ci --prefix site
                                               npm run check --prefix site
                                               npm test --prefix site
                                               SITE_BASE=/xatlas-wasm/ npm run build --prefix site
                                               node site/scripts/check-build.mjs
```

The site job runs on push and pull request, so a broken gallery, worker, test
or wasm asset fails before merge. It reuses the freshly built `dist` artifact
and does not rebuild wasm.

Add `.github/workflows/pages.yml` triggered by
`workflow_run: [Build WASM]`, gated on a successful push to `main`. It checks
out the tested revision, downloads `xatlas-wasm-dist` with the triggering
`run-id`, installs the site, builds with `SITE_BASE=/xatlas-wasm/`, and
deploys `site/dist` through `actions/configure-pages`,
`actions/upload-pages-artifact` and `actions/deploy-pages`. It needs
`contents: read`, `actions: read`, `pages: write` and `id-token: write`.

Alternatives considered:

- **Deploy inside the build workflow on `main`.** Rejected: it mixes the
  quality gate with a deployment environment and complicates PR behavior.
- **Rebuild wasm in Pages.** Rejected: the point is to deploy the artifact the
  build tested.

Manual prerequisite: the repository must have Pages enabled with the GitHub
Actions source. That is recorded in the tasks, not automated by the workflow.

### D7 — Site-local Vitest, no new package test dependency

The site has its own `vitest` dev dependency and `npm test` script. Tests run
in Node and import the pure scenario modules plus the built `xatlas-wasm`
package. They do not import three.js, the DOM or Vite-only modules.

Coverage:

- `site/test/catalog.test.ts`: six unique ids, required metadata, known
  feature/input labels.
- `site/test/demos.test.ts`: for every scenario, initialize the module, create
  an atlas, run `build`, generate, and assert:
  - `width`/`height`/`chartCount` are non-zero;
  - `vertexCount`/`indexCount` are non-zero;
  - positions and normalized UVs are finite and UVs are inside the atlas
    bounds;
  - `getImage()` dimensions and `data.length` agree when an image was
    requested;
  - the multi-atlas scenario reports `atlasCount > 1`;
  - the atlas is destroyed in `finally`.
- `site/test/obj.test.ts`: the OBJ serializer emits matching vertex/face counts
  and finite coordinates.
- `site/scripts/check-build.mjs`: production output contains a referenced
  `.wasm` asset (described in D5).

Keeping Vitest in the site avoids adding a test framework to the package
`devDependencies` and keeps `npm test` at the root focused on the package.
The root `npm test` and `npm run test:package` still run unchanged in CI.

Alternative considered: add the site tests to the root Vitest suite, as
libfive does. Rejected for xatlas because the root package deliberately has no
Vitest dependency and the site is a separate consumer.

### D8 — New code and one MIT asset

The site implementation is new code written for this change. The only external
asset is `gazebo.obj` from the pinned upstream xatlas submodule, which is MIT
licensed. It is copied into `site/src/demos/assets/gazebo.ts` as a checked-in
string with a header naming the source repository, commit and license. The other
five scenarios are generated in TypeScript.

This avoids:

- mixing MPL-2.0 libfive site code into the MIT package repository;
- a Pages checkout dependency on the submodule;
- runtime asset fetches and their failure modes.

Alternative considered: import the OBJ from `thirdparty/xatlas/models` with
Vite `?raw`. Rejected because the Pages workflow would need submodules and the
Node tests would need a different loader path.

### D9 — Documentation and backlog stay in the existing roadmap

Add **XW-025 — Publish a showcase site** to `docs/improvements.md`, with the
walking skeleton as the current change and the follow-ups recorded beneath it.
Update the status block (including the stale `wasm-loader-options` entry) and
the proposed sequence note to show this change is deliberately out of order.

Update:

- `README.md`: live showcase link and a short description of the gallery.
- `BUILD.md`: how to build and run the site locally.
- `site/README.md`: the scenario contract, how to add a scenario, build/test
  commands, asset attribution and deployment notes.
- `docs/improvements.md`: XW-025, status, follow-ups, measured outcomes.

No change to `package.json`, `lib/xatlas.d.ts`, `API.md` or the loader.

### D10 — Deferred follow-ups

These are intentionally not part of this change and have no artifacts yet:

- `showcase-gallery`: 10–12 scenarios, section filters, coverage manifest,
  option presets/A-B runs, chart hover/highlight, UV repack.
- `showcase-docs`: in-site guides and rendered `API.md`.
- `showcase-thumbnails`: checked-in WebP previews captured from the real view.
- File upload after XW-006 validates mesh inputs.
- Stress and cancellation after XW-011 (bulk result API) and XW-014 (progress
  callbacks).

## Risks / Trade-offs

- **Vite may rewrite the package's `import.meta.url` during pre-bundling** →
  Exclude `xatlas-wasm` from `optimizeDeps`, build with the real base path, and
  fail the site job when `check-build.mjs` cannot find a referenced `.wasm`.
  The existing packed-package Vite test is the precedent.
- **`getMesh()` returns objects, which is slow for large meshes** → Keep the
  six v1 models modest, flatten once in the worker, and leave the stress
  scenario to XW-011. The scenario contract does not change when the bulk API
  lands.
- **Atlas images can be large** → Transfer the raw bitfield and decode only the
  selected sub-atlas on demand; cap the displayed canvas resolution while
  keeping the raw data for downloads.
- **WebGL may be unavailable** → Show an error overlay in the 3D view while
  leaving UV, Atlas, Code, statistics and downloads usable.
- **Pages requires repository settings** → Record "enable Pages with Actions
  source" as a manual task; the workflow cannot grant itself Pages.
- **Embedding the gazebo OBJ adds 36 KB to the site** → Acceptable; it removes
  a submodule/runtime dependency and keeps the demo testable in Node.
- **Duplicating the small OBJ parser between `example/` and `site/`** → Keep
  them separate in this change; if they diverge further, extract a shared
  non-published helper in a follow-up.
- **CI time increases by a site install and build** → The site job runs after
  the wasm build, caches `site/package-lock.json`, and reuses the same artifact.
  The feedback is worth the cost because the site is a real consumer.
- **License mixing** → New site code plus one MIT asset; no MPL site code is
  copied.

## Migration Plan

This change adds a new consumer and does not migrate package users.

1. Land `site/`, the site tests and the workflows together so the first green
   build proves the wasm asset path under the Pages base.
2. Merge to `main`; the Build WASM site job validates the production build, and
   the Pages workflow deploys from that run's artifact.
3. Enable GitHub Pages with the Actions source before the first deployment.
4. Rollback is a revert of this change: remove `site/` and the two workflow
   additions. The package, loader and npm publish path are untouched.
