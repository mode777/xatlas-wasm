# Proposal

## Why

The showcase currently demonstrates charting and packing on a cube and a
procedural heightfield, and its gallery cards and hero use fabricated
chart-pattern artwork that does not correspond to any real unwrap. For a
UV-atlas library, static fake previews communicate less than the live 3D, UV
and Atlas views, while production meshes show why seams, chart growth and
packing matter. This change follows **XW-025** and replaces the synthetic
entries with realistic content: the Cesium Milk Truck and a multi-model town
level.

## What Changes

- Replace the `cube` and `terrain` catalog entries with `milk-truck` and
  `town-level`. **BREAKING (site routes):** `#/p/cube` and `#/p/terrain` now
  show the not-found page.
- Add the `milk-truck` scenario using the Khronos glTF Sample Assets
  `CesiumMilkTruck.glb` geometry, extracted once at authoring time and embedded
  as a TypeScript module. The site SHALL NOT fetch the model at runtime. The
  asset is CC BY 4.0 and is attributed in `site/src/demos/assets/NOTICE.md`.
- Add the `town-level` scenario: the MIT Gazebo, the Milk Truck and generated
  town fabric (ground, roads, buildings and props) are composed into one level
  and added as multiple xatlas meshes. It demonstrates multi-model chart growth
  and packing at level scale.
- Extend the scenario contract and worker result path to support one or more
  meshes per scenario. Every `getMesh(i)` result is flattened into the existing
  combined positions/UVs/chart IDs/atlas IDs/indices arrays; statistics sum
  input/output counts, report `meshCount`, and keep the current viewer and
  downloads unchanged.
- Remove the decorative preview artwork from the gallery: cards become
  text-only (ordinal, title, description, features, input kind) and the hero
  loses its atlas-board illustration. The live 3D, UV and Atlas views remain
  the only previews.
- Update site validation, asset provenance, `site/README.md`, `README.md` and
  the XW-025 follow-up note in `docs/improvements.md`.
- No loader/artifact, public API, package-layout or CI/release behaviour
  changes. The separate `dist/xatlas.wasm` contract, the ESM-only package and
  the single-threaded kernel are unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `showcase-site`: the gallery catalog, text-only gallery presentation,
  multi-mesh scenario results, realistic asset provenance and validation. The
  base capability was synced from the completed `showcase-site` change before
  this delta was written.

## Impact

- **Removed:** `site/src/demos/scenarios/cube.ts`,
  `site/src/demos/scenarios/terrain.ts`, and the now-unused cube/terrain
  generators in `site/src/demos/geometry.ts`.
- **Added:** `site/src/demos/scenarios/milk-truck.ts`,
  `site/src/demos/scenarios/town-level.ts`, a generated
  `site/src/demos/assets/milk-truck.ts`, a GLB extraction script under
  `site/scripts/`, and town-level composition helpers.
- **Changed:** `site/src/demos/index.ts`, `site/src/demos/types.ts`,
  `site/src/demos/mesh.ts`, `site/src/worker/run-scenario.ts`,
  `site/src/gallery.ts`, `site/src/styles.css`, and the site tests.
- **Docs:** `site/README.md`, `README.md`, `docs/improvements.md`.
- **Package:** unchanged; `site/` remains excluded from the npm tarball and
  gains no new runtime dependency.
- **Deliberately out of scope:** the rest of the `showcase-gallery` follow-up
  (filters, coverage manifest, option presets/A-B runs, chart highlighting, UV
  repack), `showcase-docs`, `showcase-thumbnails`, file upload (XW-006), and
  stress/cancel scenarios (XW-011/XW-014).
