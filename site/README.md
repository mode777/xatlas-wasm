# xatlas-wasm showcase

The public demo gallery for `xatlas-wasm`: six realistic mesh-unwrapping
scenarios with 3D, UV, atlas and source views, running the real WebAssembly
build in a worker. The catalog is `gazebo`, `milk-truck`, `town-level`,
`uv-sphere`, `packing-lab` and `multi-atlas`; `town-level` composes several
models into one multi-mesh scene.

This directory is a **separate consumer** of the package. It is not part of the
npm tarball, and it always links the local package (`xatlas-wasm: file:..`) —
never a registry copy. The package itself stays runtime-dependency-free.

## Prerequisites

- Node.js >= 20 for the site toolchain (the published package still supports
  Node.js >= 16).
- Emscripten 3.1.64 active if you need to rebuild the wasm artifact.
- A built root checkout: `dist/index.mjs` and `dist/xatlas.wasm` must exist.

## Run

From the repository root:

```sh
source ../emsdk/emsdk_env.sh   # only when rebuilding the wasm
npm ci
npm run build
```

Then build and run the site:

```sh
cd site
npm ci
npm run dev        # http://localhost:5173/
```

Production build and checks:

```sh
npm run check      # tsc --noEmit
npm test           # Vitest: catalog, geometry, OBJ, atlas decoding, unwrap
npm run build      # Vite build into site/dist
npm run build:check
npm run preview
```

For the project Pages URL, build with the base path:

```sh
SITE_BASE=/xatlas-wasm/ npm run build
SITE_BASE=/xatlas-wasm/ npm run build:check
```

`build:check` fails when the production output does not contain a `.wasm`
asset or when no built JavaScript references it. That is the guard for the
package's default `new URL('xatlas.wasm', import.meta.url)` loader surviving
Vite and the Pages base path.

## Scenario contract

Each scenario is a pure TypeScript module under `src/demos/scenarios/` with
metadata and a `build(context)`:

```ts
import type { DemoDefinition } from '../types.js';

const demo: DemoDefinition = {
  meta: {
    id: 'my-scenario',
    title: 'My scenario',
    description: 'One sentence about what this unwrap demonstrates.',
    features: ['padding', 'charts'],
    input: 'generated', // or 'asset'
  },
  chartOptions: { maxCost: 1.5 },
  packOptions: { createImage: true, padding: 2, bilinear: true },
  build(context) {
    context.addMesh({ positions, indices });
    return { kind: 'mesh', positions, indices };
  },
};

export default demo;
```

A scenario may return one mesh or an array. For a multi-model scene, use the
`addMeshes` helper so every mesh is added in order:

```ts
import { addMeshes } from '../mesh.js';

build(context) {
  return addMeshes(context, [ground, buildings, truck]);
}
```

Rules:

- `id` is stable, kebab-case and matches the module filename.
- `build` owns the `addMesh`/`addUvMesh` calls. The worker owns the atlas, sets
  the progress callback, calls `generate`, and destroys the atlas.
- A multi-mesh scenario must return the inputs in the same order it added them;
  the worker flattens every `getMesh(i)` result into one combined result.
- Modules must not import the DOM, three.js or Vite-only `?raw` modules. The
  Node validation suite imports them directly.
- Keep generated meshes modest: `getMesh()` returns one object per output
  vertex, and the bulk result API (XW-011) is not implemented yet.
- Scenario source is discovered automatically by `src/demos/sources.ts`; the
  Code tab shows that exact file.

## Add a scenario

1. Add `src/demos/scenarios/<id>.ts` using the contract above.
2. Import it in `src/demos/index.ts` and append it to `demos`.
3. Pick feature labels that describe the xatlas behaviour on display.
4. Run `npm run check && npm test`. The catalog and unwrap tests cover every
   entry in `demos`; add a generator test if you add a new mesh helper.
5. Open `#/p/<id>` in `npm run dev` and verify all four views.

## Worker and data flow

The module worker initializes `createXAtlas()` once and reuses it for every
run. For each run it:

1. creates an atlas and registers a progress callback;
2. calls the scenario's `build(context)`, which adds one or more meshes;
3. calls `atlas.generate(chartOptions, packOptions)`;
4. copies every `getMesh(i)` and `getImage()` into flat typed arrays
   (`positions`, normalised `uvs`, `chartIds`, `atlasIds`, `indices`) plus
   per-mesh offsets and statistics;
5. destroys the atlas and posts the arrays with transferables.

The main thread never holds a wasm object. The 3D viewport, UV canvas, atlas
canvas and OBJ/PNG downloads all work from the copied result, so switching
views never re-runs the unwrap.

## Assets and licensing

Two external models are embedded as source modules; see
`src/demos/assets/NOTICE.md` for the full provenance:

- `gazebo.obj` from the pinned upstream xatlas submodule (MIT), copied into
  `src/demos/assets/gazebo.ts`.
- `CesiumMilkTruck.glb` from Khronos glTF Sample Assets (CC BY 4.0), extracted
  into `src/demos/assets/milk-truck.ts`.

The Milk Truck module contains only positions and indices; textures, materials,
animation and the Cesium logo texture are not used. Regenerate it from a local
copy of the GLB with:

```sh
node scripts/embed-glb.mjs /path/to/CesiumMilkTruck.glb \
  src/demos/assets/milk-truck.ts
```

The extraction script applies the glTF scene-node world transforms and records
the source URL, commit, license, copyright and SHA-256. `town-level` reuses the
Gazebo and Milk Truck and generates its remaining town fabric in TypeScript.

## Deployment

`.github/workflows/pages.yml` runs after a successful `Build WASM` push to
`main`. It downloads that run's `xatlas-wasm-dist` artifact, builds the site
with `SITE_BASE=/xatlas-wasm/`, and deploys `site/dist` to GitHub Pages at
<https://mode777.github.io/xatlas-wasm/>.

The repository must have Pages enabled with the **GitHub Actions** source.
That is a manual repository setting, not part of the workflow. The `site` job
in `Build WASM` typechecks, tests and builds the same site on every push and
pull request, so a broken scenario or missing wasm asset fails before merge.

## Related example

The zero-build [`example/`](../example/) remains the smallest browser
integration: one HTML page, three canvases and a direct `dist/index.mjs`
import. The showcase is the larger, routed consumer.
