# Tasks

## 1. Milk Truck asset extraction and provenance

- [x] 1.1 Add `site/scripts/embed-glb.mjs` that parses a local GLB, composes scene-node world transforms, extracts every indexed `TRIANGLES` primitive's positions and indices, validates finite positions and in-range indices, and writes a typed-array TypeScript asset module with source metadata. Verify by running it against the pinned `CesiumMilkTruck.glb` and checking the generated file exists.
- [x] 1.2 Generate `site/src/demos/assets/milk-truck.ts` from Khronos glTF Sample Assets commit `8f492390ddc7a2ae221a1369ef560589cf8c70fb` and record its vertex/triangle counts and source SHA-256 in the module header. Verify the module reports 4,823 positions and 3,624 triangles (the wheel mesh is instanced by two nodes).
- [x] 1.3 Extend `site/src/demos/assets/NOTICE.md` with the Milk Truck source URL, pinned revision, CC BY 4.0 license, copyright, extraction command and a note that only geometry is embedded. Verify the notice contains every provenance field.
- [x] 1.4 Add `site/test/assets.test.ts` covering the Milk Truck asset: non-empty positions/indices, finite values, valid index range, expected counts and provenance fields. Verify with `cd site && npm test -- test/assets.test.ts` (or the site test command).

## 2. Multi-mesh scenario contract and worker

- [x] 2.1 Extend `site/src/demos/types.ts` so `DemoDefinition.build` may return one `DemoInput` or a readonly array, and add `addMeshes(context, inputs)` to `site/src/demos/mesh.ts` that adds every mesh in order. Verify TypeScript with `cd site && npm run check`.
- [x] 2.2 Update `site/src/worker/run-scenario.ts` to normalise the scenario inputs, assert the input count matches `atlas.meshCount`, flatten every `getMesh(i)` into the combined arrays with index offsets, concatenate chart metadata and sum the input/output counts. Verify the existing scenario tests still pass.
- [x] 2.3 Add worker/result tests that cover a two-mesh fixture: combined counts, offset indices, preserved source positions and `meshCount`. Verify the new test fails when only `getMesh(0)` is flattened and passes after the change.
- [x] 2.4 Confirm the atlas is still destroyed in `finally`, the worker transferable list still covers every combined buffer, and the viewer/download consumers need no changes. Verify the existing worker and DOM tests pass.

## 3. Realistic catalog and town level

- [x] 3.1 Add `site/src/demos/scenarios/milk-truck.ts` using the embedded asset, with asset input metadata and a pack recipe that produces an atlas image. Verify the scenario unwraps through `runScenario`.
- [x] 3.2 Add `site/src/demos/town.ts` with transform/compose helpers and generated town fabric (ground, roads, buildings and props), then add `site/src/demos/scenarios/town-level.ts` that composes the Gazebo, Milk Truck and town meshes through `addMeshes`. Verify the level returns at least two meshes and non-empty finite geometry.
- [x] 3.3 Remove `site/src/demos/scenarios/cube.ts` and `site/src/demos/scenarios/terrain.ts`, remove the unused cube/terrain generators from `site/src/demos/geometry.ts`, make `createDenseGrid` standalone, and update `site/src/demos/index.ts` to the six-scenario catalog. Verify `#/p/cube` and `#/p/terrain` are no longer in the catalog.
- [x] 3.4 Update `site/test/catalog.test.ts` to the six new IDs and `site/test/geometry.test.ts` to remove cube/terrain tests and cover the town helpers. Verify `cd site && npm test -- test/catalog.test.ts test/geometry.test.ts`.
- [x] 3.5 Extend `site/test/demos.test.ts` to assert `town-level` has `meshCount > 1`, that every added mesh contributes output, and that combined counts match. Verify the full scenario suite with `cd site && npm test -- test/demos.test.ts`.
- [x] 3.6 Tune the town-level triangle count and pack options so the scenario unwraps within the existing 60-second test timeout and the atlas stays readable. Verify by recording the run duration and output counts.

## 4. Gallery without fabricated preview art

- [x] 4.1 Remove the `.demo-card-visual` block, generated chart spans and hero board from `site/src/gallery.ts`; move the ordinal and input badge into the card body. Verify the gallery still renders six cards with title, description, features and input kind.
- [x] 4.2 Delete the corresponding `.hero-board*`, `.demo-card-visual`, `.demo-card-grid` and `.demo-card-chart*` rules and responsive overrides from `site/src/styles.css`, and restyle the ordinal/input badge in normal flow. Verify the production build has no unused preview-art selectors.
- [x] 4.3 Update `site/test/dom.test.ts` to assert six text-only cards and no `.demo-card-visual`, `.hero-board`, `<img>` or `<canvas>` in the gallery, while scenario pages still expose the 3D, UV, Atlas and Code tabs. Verify the test fails against the old gallery and passes after the change.

## 5. Documentation and backlog

- [x] 5.1 Update `site/README.md` with the new scenario list, the multi-mesh scenario contract, the Milk Truck attribution and the asset regeneration command. Verify every command and path in the document exists.
- [x] 5.2 Update `README.md` so the live gallery description matches the new realistic catalog. Verify it no longer claims or implies cube/terrain previews.
- [x] 5.3 Update the XW-025 progress/follow-up entry in `docs/improvements.md` to record this realistic-scenario refresh and the remaining `showcase-gallery` work. Verify the item still references `showcase-site` and does not claim the deferred features are done.
- [x] 5.4 Update `BUILD.md` only if the site commands changed; otherwise confirm it remains accurate. Verify the documented site build/test commands still run.

## 6. Integration verification

- [x] 6.1 Run `cd site && npm run check && npm test` and verify typecheck and the full Vitest suite pass.
- [x] 6.2 Build with the Pages base path: `cd site && SITE_BASE=/xatlas-wasm/ npm run build && npm run build:check`, and verify the hashed `xatlas.wasm` asset is still emitted and referenced.
- [x] 6.3 Record the production chunk/gzip sizes and the town-level run duration in `docs/improvements.md`; verify the lazy demo chunk stays within the agreed budget.
- [x] 6.4 Run the root package smoke test (`npm test`) to confirm the site-only change leaves the package runtime untouched.
- [x] 6.5 Run `npx @fission-ai/openspec@latest validate --all --strict` and verify every change and spec passes.

## Workflow follow-up

- Archive the change after review and after all tracked tasks are complete.
- Verify the archived change and the updated `showcase-site` spec.
