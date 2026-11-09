# Tasks

## 1. Site scaffold and build configuration

- [x] 1.1 Create `site/package.json` (private, `type: module`, `xatlas-wasm: file:..`), `site/package-lock.json`, `site/tsconfig.json`, `site/vite.config.ts` (base from `SITE_BASE`, ES worker format, `optimizeDeps.exclude: ['xatlas-wasm']`, `server.fs.allow: ['..']`), `site/index.html` and the app entry; verify `npm ci --prefix site`, `npm run check --prefix site` and a placeholder `npm run build --prefix site` succeed.
- [x] 1.2 Add the root `.gitignore` entries for `site/node_modules/`, `site/dist/` and `site/.vite/`; verify `git status --short` does not list generated site output.
- [x] 1.3 Add `site/README.md` with the local package relationship, run/build/test commands and the "not part of the npm tarball" rule; verify every command in the README runs as written from `site/`.
- [x] 1.4 Add the app shell, hash router (`#/`, `#/p/<id>`, not-found), page chrome and responsive styles; verify `npm run dev --prefix site` renders the gallery shell and an unknown route shows the not-found page.

## 2. Scenario catalog and demo contract

- [x] 2.1 Define `DemoMeta`, `DemoContext`, `DemoInput`, `DemoDefinition` and the catalog index under `site/src/demos/`; keep the modules free of DOM, three.js and Vite-only imports, and verify `npm run check --prefix site` plus a catalog test for unique ids and required metadata.
- [x] 2.2 Add pure procedural mesh helpers for the cube, UV sphere, terrain, packing panels and dense multi-atlas grid; verify unit tests assert non-empty indices, finite positions and the expected vertex/face counts.
- [x] 2.3 Copy the MIT-licensed `gazebo.obj` into `site/src/demos/assets/gazebo.ts` with source/commit/license attribution, and add the OBJ parser; verify a test parses it to non-empty positions and indices and that `site/src/demos/assets/NOTICE.md` records the asset provenance.
- [x] 2.4 Implement the six scenario modules (`gazebo`, `cube`, `uv-sphere`, `terrain`, `packing-lab`, `multi-atlas`) with metadata, `build(context)` and chart/pack options; verify `site/test/demos.test.ts` unwraps each scenario and that `multi-atlas` reports more than one sub-atlas.
- [x] 2.5 Add the "Add a scenario" section to `site/README.md` (metadata fields, source registration, validation command); verify the documented steps match the catalog and the test names.

## 3. Worker, flattening and wasm loading

- [x] 3.1 Implement the worker protocol (`run`, `progress`, `result`, `error`) and the main-thread client; verify `npm run check --prefix site` and that a second run after a completed or failed run is accepted.
- [x] 3.2 Implement a reusable `runScenario(xatlas, demo)` core that creates and owns the atlas, sets the progress callback, calls `demo.build`, generates, reads `getMesh(0)` and `getImage()`, flattens positions/UVs/chart ids/atlas ids/indices/stats, and destroys the atlas in `finally`; verify the demo test runs through this core.
- [x] 3.3 Add `site/scripts/check-build.mjs` and the `build:check` script; verify `SITE_BASE=/xatlas-wasm/ npm run build --prefix site` emits a hashed `.wasm`, the checker exits `0`, and temporarily hiding/removing the wasm file makes the checker exit non-zero naming the missing asset.
- [x] 3.4 Wire progress and error states into the scenario page; verify a forced `addMesh` failure shows the worker error instead of a blank viewport and that a successful rerun clears it.
- [x] 3.5 Document the worker/result flow and the wasm asset check in `site/README.md`; verify the documented `npm run build:check` command fails and passes as described.

## 4. 3D, UV, Atlas and Code views

- [x] 4.1 Implement the three.js viewport: orbit, zoom, resize, camera framing and `BufferGeometry` from the flattened arrays; verify the gazebo scenario renders and the viewport remains stable after resizing.
- [x] 4.2 Implement the shaded, checker, chart-color, atlas-texture and wireframe modes; verify each mode is switchable without a new worker run and that chart colors stay stable across view switches.
- [x] 4.3 Implement the UV view with chart-colored triangles, atlas bounds and sub-atlas selection; verify a Node test covers the triangle-to-canvas mapping and the browser shows the gazebo layout.
- [x] 4.4 Implement the Atlas view with bitfield decoding, chart/padding/bilinear/empty colors, a legend, sub-atlas selection and the no-image state; verify a Node test covers every decoded class and the browser shows the gazebo texel map.
- [x] 4.5 Implement the Code view with the exact module source, syntax highlighting and lazy loading; verify every catalog id has a source entry and the displayed text matches the module file.
- [x] 4.6 Add keyboard-accessible tabs and preserve the current view when switching tabs; verify arrow-key navigation and that returning to 3D does not trigger a new run.

## 5. Gallery, statistics and downloads

- [x] 5.1 Implement the gallery cards with title, description, feature labels, input kind and stable routes; verify all six scenarios appear and direct links resolve.
- [x] 5.2 Implement the statistics and recipe panel (resolution, charts, atlases, per-atlas utilization, texels/unit, input/output counts, duration and options); verify the displayed values match the run result and multi-atlas utilization lists every sub-atlas.
- [x] 5.3 Implement the OBJ serializer and download; verify `site/test/obj.test.ts` checks vertex/face counts and finite coordinates and the downloaded file opens as a valid OBJ.
- [x] 5.4 Implement the atlas PNG download for the selected sub-atlas and the disabled state when no image exists; verify the downloaded PNG dimensions match the atlas and the button is unavailable without an image.

## 6. CI, Pages and documentation

- [x] 6.1 Add the `site` job to `.github/workflows/build-wasm.yml` with `needs: build`, same-run `xatlas-wasm-dist` download, `npm ci --prefix site`, typecheck, tests, `SITE_BASE=/xatlas-wasm/` build and `check-build.mjs`; verify the workflow YAML parses and the same command sequence passes locally.
- [x] 6.2 Add `.github/workflows/pages.yml` triggered by a successful Build WASM run on `main`, with the required permissions, tested-revision checkout, artifact download by run id, `SITE_BASE=/xatlas-wasm/` build and Pages deployment; verify the YAML parses and every step matches the local build sequence.
- [x] 6.3 Document the Pages prerequisite (enable Pages with the Actions source) and the deploy behavior in `site/README.md` and `BUILD.md`; verify the documented URL/base path matches the workflow.
- [x] 6.4 Add the showcase link to `README.md` and a short "Showcase" section to `BUILD.md`; verify the link target, local commands and package-relationship wording are correct.
- [x] 6.5 Add **XW-025 — Publish a showcase site** to `docs/improvements.md`, record the six-scenario walking skeleton and the deferred follow-ups, update the stale `wasm-loader-options` status and note that this change runs out of sequence; verify the backlog section, sequence table and status block agree.

## 7. Integration verification

- [x] 7.1 From a clean built checkout run `npm test` and `npm run test:package`; verify both pass and the package tarball still excludes `site/`.
- [x] 7.2 Run `npm ci --prefix site && npm run check --prefix site && npm test --prefix site && SITE_BASE=/xatlas-wasm/ npm run build --prefix site && node site/scripts/check-build.mjs`; verify every command exits `0`.
- [x] 7.3 Serve `site/dist` under the Pages base path and verify the gallery, gazebo and multi-atlas scenarios, all four views, the display modes, statistics and both downloads with no console errors.
- [x] 7.4 Run `npm pack --dry-run` and confirm no `site/` file or showcase-only dependency appears; verify the published file list is unchanged from the pre-change output.
- [x] 7.5 Run `openspec validate --all --strict`; verify it passes before archive.

## Workflow follow-up

- Review the implemented change against the specs and the measured site build result.
- Commit the implementation to `main` with a concise imperative subject.
- Archive the change after review and verify the synced `showcase-site` spec and archived change directory.
