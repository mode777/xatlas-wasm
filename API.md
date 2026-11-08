# xatlas-wasm API Reference

JavaScript/WebAssembly bindings for the [xatlas](https://github.com/jpcy/xatlas) UV atlas generation library. xatlas generates unique texture coordinates suitable for baking lightmaps or texture painting.

> **Known limitations**
>
> - `faceIgnoreData` is not exposed (XW-009).
> - Only `Uint16Array` and `Uint32Array` index buffers are supported. Other
>   typed arrays are currently misinterpreted rather than rejected (XW-006).
> - Atlas objects require an explicit `destroy()`; there is no GC safety net
>   yet (XW-007).
>
> The WASM binary ships as a separate `dist/xatlas.wasm` beside the package
> entry; `createXAtlas(options?)` accepts `wasmBinary`, `locateFile`, `print`
> and `printErr`. See [docs/improvements.md](docs/improvements.md) for the full
> backlog.

## Table of Contents

- [Installation & Setup](#installation--setup)
- [Quick Start](#quick-start)
- [Module Initialization](#module-initialization)
  - [`createXAtlas(options?)`](#createxatlasoptions)
- [XAtlasModule](#xatlasmodule)
  - [`createAtlas()`](#createatlas)
  - [`addMeshErrorString(error)`](#addmesherrorstringerror)
  - [`progressCategoryString(category)`](#progresscategorystringcategory)
- [XAtlas (Atlas Instance)](#xatlas-atlas-instance)
  - [Methods](#methods)
    - [`addMesh(options)`](#addmeshoptions)
    - [`addUvMesh(options)`](#adduvmeshoptions)
    - [`addMeshJoin()`](#addmeshjoin)
    - [`computeCharts(options?)`](#computechartsoptions)
    - [`packCharts(options?)`](#packchartsoptions)
    - [`generate(chartOptions?, packOptions?)`](#generatechartoptions-packoptions)
    - [`setProgressCallback(callback)`](#setprogresscallbackcallback)
    - [`getUtilization(atlasIndex)`](#getutilizationatlasindex)
    - [`getMesh(meshIndex)`](#getmeshmeshindex)
    - [`getImage()`](#getimage)
    - [`destroy()`](#destroy)
  - [Properties (read-only)](#properties-read-only)
- [Option Types](#option-types)
  - [`MeshDeclOptions`](#meshdecloptions)
  - [`UvMeshDeclOptions`](#uvmeshdecloptions)
  - [`ChartOptions`](#chartoptions)
  - [`PackOptions`](#packoptions)
- [Output Types](#output-types)
  - [`Mesh`](#mesh)
  - [`AtlasImage`](#atlasimage)
  - [`Vertex`](#vertex)
  - [`Chart`](#chart)
- [Enumerations](#enumerations)
  - [`ChartType`](#charttype)
  - [`IndexFormat`](#indexformat)
  - [`AddMeshError`](#addmesherror)
  - [`ProgressCategory`](#progresscategory)
- [Image Pixel Format](#image-pixel-format)
- [Workers](#workers)
- [Workflows](#workflows)
  - [Simple Atlas Generation](#simple-atlas-generation)
  - [Step-by-Step (Editor Integration)](#step-by-step-editor-integration)
  - [UV Repacking](#uv-repacking)
- [Examples](#examples)
  - [Node.js](#nodejs)
  - [Browser](#browser)

---

## Installation & Setup

```bash
npm install xatlas-wasm
```

Or build from source:

```bash
npm ci
npm run configure   # requires Emscripten (emcmake)
npm run build
```

The package is ESM-only and requires Node.js >= 16 or a modern browser with
WebAssembly. Import it with:

```js
import createXAtlas from 'xatlas-wasm';
```

---

## Quick Start

```js
import createXAtlas from 'xatlas-wasm';

const xatlas = await createXAtlas();
const atlas = xatlas.createAtlas();

// Add a mesh (positions as flat xyz Float32Array, indices as Uint32Array)
const error = atlas.addMesh({ positions, indices });
if (error !== xatlas.AddMeshError.Success) {
  throw new Error('addMesh failed: ' + xatlas.addMeshErrorString(error));
}

// Generate the atlas
atlas.generate();

// Read results
console.log(`Atlas size: ${atlas.width} × ${atlas.height}`);
const mesh = atlas.getMesh(0);
for (let i = 0; i < mesh.vertexCount; i++) {
  const v = mesh.vertices[i];
  // v.uv[0], v.uv[1] — atlas UV coordinates (in texels, not normalized)
  // v.xref — index of the corresponding input vertex
}

atlas.destroy();
```

---

## Module Initialization

### `createXAtlas(options?)`

Initializes the xatlas WebAssembly module. Returns a promise that resolves to an [`XAtlasModule`](#xatlasmodule).

```ts
function createXAtlas(options?: CreateXAtlasOptions): Promise<XAtlasModule>
```

The package ships `dist/xatlas.wasm` beside the JavaScript entry. With no
options the Emscripten glue resolves it with
`new URL('xatlas.wasm', import.meta.url)`, which bundlers such as Vite,
webpack 5 and Rollup emit automatically. Without a bundler, copy
`xatlas.wasm` next to `index.mjs`, or pass `locateFile`/`wasmBinary`.

#### `CreateXAtlasOptions`

| Property | Type | Description |
|---|---|---|
| `wasmBinary` | `ArrayBuffer \| ArrayBufferView` | Explicit WASM bytes. Takes precedence over `locateFile`; when supplied, the loader does not resolve or fetch `xatlas.wasm`. |
| `locateFile` | `(path: string, prefix: string) => string` | Resolve the WASM artifact path and prefix to a URL. Only called when `wasmBinary` is not supplied. |
| `print` | `(text: string) => void` | Redirect the Emscripten module's standard output. |
| `printErr` | `(text: string) => void` | Redirect the Emscripten module's standard error. |

```js
// Custom URL
const xatlas = await createXAtlas({
  locateFile: (path) => `/static/wasm/${path}`,
});
```

```js
// Explicit bytes (the binary is not fetched)
const wasmBinary = await (await fetch('/assets/xatlas.wasm')).arrayBuffer();
const xatlas = await createXAtlas({ wasmBinary });
```

Invalid option types reject with a `TypeError` naming the offending option.
If the artifact cannot be loaded, `createXAtlas()` rejects with an `Error` that
names `xatlas.wasm` and preserves the underlying cause as `cause`.

---

## XAtlasModule

The object returned by `createXAtlas()`. Provides factory methods and enum constants.

### `createAtlas()`

Create a new atlas instance.

```ts
createAtlas(): XAtlas
```

Returns an [`XAtlas`](#xatlas-atlas-instance) instance. You must call [`destroy()`](#destroy) when finished to free WASM memory.

### `addMeshErrorString(error)`

Get a human-readable string for an `AddMeshError` code.

```ts
addMeshErrorString(error: AddMeshError): string
```

### `progressCategoryString(category)`

Get a human-readable string for a `ProgressCategory` code.

```ts
progressCategoryString(category: ProgressCategory): string
```

### Enum Constants

The module object also exposes the enum constants directly:

| Property           | Type                                    |
|-------------------|-----------------------------------------|
| `ChartType`       | [`ChartType`](#charttype)               |
| `IndexFormat`     | [`IndexFormat`](#indexformat)            |
| `AddMeshError`    | [`AddMeshError`](#addmesherror)         |
| `ProgressCategory`| [`ProgressCategory`](#progresscategory) |

---

## XAtlas (Atlas Instance)

Created via `xatlas.createAtlas()`. Represents a single atlas generation session.

### Methods

#### `addMesh(options)`

Add a triangle mesh to the atlas for UV generation.

```ts
addMesh(options: MeshDeclOptions): AddMeshError
```

Returns an [`AddMeshError`](#addmesherror) code. `0` (`AddMeshError.Success`) on success.

Multiple meshes can be added. Each will get a corresponding output mesh after generation.

**Example:**

```js
const err = atlas.addMesh({
  positions: new Float32Array([0,0,0, 1,0,0, 1,1,0, 0,1,0]),
  indices: new Uint32Array([0,1,2, 0,2,3]),
  normals: normalsFloat32Array,   // optional
  uvs: uvsFloat32Array,           // optional, used as hint
});
```

---

#### `addUvMesh(options)`

Add a UV mesh for repacking existing UVs into a shared atlas. Use this when meshes already have texture coordinates and you want to pack them together.

```ts
addUvMesh(options: UvMeshDeclOptions): AddMeshError
```

Returns an [`AddMeshError`](#addmesherror) code.

> **Note:** When using `addUvMesh`, call [`packCharts()`](#packchartsoptions) directly instead of `generate()` or `computeCharts()`.

**Example:**

```js
const err = atlas.addUvMesh({
  uvs: new Float32Array([0,0, 1,0, 1,1, 0,1]),
  indices: new Uint32Array([0,1,2, 0,2,3]),
});
atlas.packCharts({ resolution: 1024 });
```

---

#### `addMeshJoin()`

Wait for asynchronous `addMesh` processing to finish. Called internally by `computeCharts()` and `generate()`, so you typically don't need to call this manually.

```ts
addMeshJoin(): void
```

---

#### `computeCharts(options?)`

Segment all added meshes into charts and parameterize them. This is the first step of the two-step generation workflow.

```ts
computeCharts(options?: ChartOptions): void
```

Can be called multiple times with different options to re-segment.

---

#### `packCharts(options?)`

Pack computed charts into one or more atlas textures. Call after `computeCharts()`, or directly after `addUvMesh()`.

```ts
packCharts(options?: PackOptions): void
```

Can be called multiple times with different options (e.g. to tweak resolution or texels-per-unit) without re-computing charts.

---

#### `generate(chartOptions?, packOptions?)`

Generate the atlas in a single call. Equivalent to calling `computeCharts()` followed by `packCharts()`.

```ts
generate(chartOptions?: ChartOptions, packOptions?: PackOptions): void
```

Can be called multiple times to regenerate with different parameters.

**Example:**

```js
atlas.generate(
  { maxChartArea: 0, maxIterations: 4 },
  { resolution: 1024, padding: 2 }
);
```

---

#### `setProgressCallback(callback)`

Set a callback to monitor generation progress. Pass `null` to clear.

```ts
setProgressCallback(callback: ProgressCallback | null): void
```

**Callback signature:**

```ts
type ProgressCallback = (category: ProgressCategory, progress: number) => boolean
```

- `category` — The current processing stage (see [`ProgressCategory`](#progresscategory)).
- `progress` — Percentage complete (0–100).
- **Return `true`** to continue, **`false`** to cancel generation.

**Example:**

```js
atlas.setProgressCallback((category, progress) => {
  const name = xatlas.progressCategoryString(category);
  console.log(`${name}: ${progress}%`);
  return true; // continue
});
```

---

#### `getUtilization(atlasIndex)`

Get the texel utilization ratio for a sub-atlas.

```ts
getUtilization(atlasIndex: number): number
```

Returns a value between 0 and 1. For example, `0.8` means 80% of texels are used (20% empty space). Only valid after packing.

> **Note:** `atlasIndex` is not bounds-checked in `0.1.3` (XW-010). Pass a value
> in `[0, atlasCount)`.

---

#### `getMesh(meshIndex)`

Retrieve the output mesh for a given input mesh (by the order it was added with `addMesh` or `addUvMesh`).

```ts
getMesh(meshIndex: number): Mesh
```

Returns a [`Mesh`](#mesh) object containing new vertices with atlas UVs, indices, and chart information.

> **Important:** Output meshes have more vertices than input meshes because UV seams require vertex duplication. The index count remains the same. Use the `xref` field on each vertex to map back to the original input vertex.

> **Note:** `meshIndex` is not bounds-checked in `0.1.3` (XW-010). Pass a value
> in `[0, meshCount)`. After `destroy()`, result access is undefined rather
> than throwing (XW-007).

---

#### `getImage()`

Retrieve the atlas image texel map. The image is only created when packing ran with [`createImage: true`](#packoptions) — otherwise this returns `null`.

```ts
getImage(): AtlasImage | null
```

Returns an [`AtlasImage`](#atlasimage) whose `data` is a flat `Uint32Array` of `atlasCount * width * height` elements. Each element is a **bitfield, not an RGBA color** (see [Image Pixel Format](#image-pixel-format)). Sub-atlas `i` occupies:

```js
data.subarray(i * width * height, (i + 1) * width * height)
```

Texels are stored row-major (left to right, top to bottom) per sub-atlas.

Returns `null` when:
- `createImage` was not set (it defaults to `false`), or
- `generate()` / `packCharts()` has not been called yet.

The returned `data` is a copy of the WebAssembly heap, so it remains valid after `destroy()`.

**Example — count chart-covered texels and build a debug image:**

```js
atlas.generate({}, { createImage: true });
const image = atlas.getImage();

if (image) {
  const { width, height, atlasCount, data } = image;

  let covered = 0;
  for (const pixel of data) {
    if (xatlas.decodeImagePixel(pixel).hasChartIndex) covered++;
  }
  console.log(`${covered} covered texels in ${atlasCount} atlas(es)`);
  console.log(`data length: ${data.length} (expected ${atlasCount * width * height})`);

  // RGBA debug view of sub-atlas 0: hash chart index into a color,
  // dim padding texels and tint bilinear texels.
  const rgba = new Uint8ClampedArray(width * height * 4);
  const atlas0 = data.subarray(0, width * height);
  for (let i = 0; i < atlas0.length; i++) {
    const p = xatlas.decodeImagePixel(atlas0[i]);
    const v = p.hasChartIndex ? (Math.imul(p.chartIndex, 2654435761) >>> 24) : 0;
    rgba[i * 4 + 0] = p.isPadding ? v >> 2 : v;
    rgba[i * 4 + 1] = p.isBilinear ? v >> 1 : v;
    rgba[i * 4 + 2] = v;
    rgba[i * 4 + 3] = 255;
  }
  // new ImageData(rgba, width, height) — draw onto a canvas
}
```

---

#### `destroy()`

Destroy the atlas and free all associated WebAssembly memory. Must be called when you are done with the atlas.

```ts
destroy(): void
```

---

### Properties (read-only)

These properties are populated after calling `generate()` or `packCharts()`.

| Property        | Type     | Description |
|----------------|----------|-------------|
| `width`        | `number` | Atlas width in texels. |
| `height`       | `number` | Atlas height in texels. |
| `atlasCount`   | `number` | Number of sub-atlases generated. |
| `chartCount`   | `number` | Total number of charts across all meshes. |
| `meshCount`    | `number` | Number of output meshes (equal to the number of `addMesh`/`addUvMesh` calls). |
| `texelsPerUnit` | `number` | Texels per world-space unit. |

---

## Option Types

### `MeshDeclOptions`

Options passed to [`addMesh()`](#addmeshoptions).

| Property          | Type                         | Required | Description |
|------------------|------------------------------|----------|-------------|
| `positions`      | `Float32Array`               | **Yes**  | Vertex positions as flat `[x,y,z, x,y,z, …]`. Length must be `vertexCount × 3`. |
| `normals`        | `Float32Array`               | No       | Vertex normals as flat `[x,y,z, …]`. Same length as positions. Improves chart quality. |
| `uvs`            | `Float32Array`               | No       | Vertex UVs as flat `[u,v, …]`. Used as a hint to the chart generator. |
| `indices`        | `Uint16Array \| Uint32Array` | No       | Triangle indices. Must be exactly `Uint16Array` or `Uint32Array`; other typed arrays are currently misinterpreted. If omitted, vertices are assumed to be non-indexed triangles (every 3 vertices form a face). |
| `faceMaterialData` | `Uint32Array`              | No       | Per-face material IDs. Only faces with the same material will be placed in the same chart. Length = number of faces. |
| `meshCountHint`  | `number`                     | No       | Hint for total mesh count. Can improve performance when adding many meshes. Default: `0`. |

---

### `UvMeshDeclOptions`

Options passed to [`addUvMesh()`](#adduvmeshoptions).

| Property          | Type                         | Required | Description |
|------------------|------------------------------|----------|-------------|
| `uvs`            | `Float32Array`               | **Yes**  | Vertex UVs as flat `[u,v, …]`. |
| `indices`        | `Uint16Array \| Uint32Array` | No       | Triangle indices. |
| `faceMaterialData` | `Uint32Array`              | No       | Per-face material IDs. Overlapping UVs should have different materials. |

---

### `ChartOptions`

Options for chart computation, passed to [`computeCharts()`](#computechartsoptions) or [`generate()`](#generatechartoptions-packoptions).

| Property                 | Type      | Default | Description |
|-------------------------|-----------|---------|-------------|
| `maxChartArea`          | `number`  | `0`     | Maximum chart area. 0 = no limit. |
| `maxBoundaryLength`     | `number`  | `0`     | Maximum chart boundary length. 0 = no limit. |
| `normalDeviationWeight` | `number`  | `2.0`   | Weight for angle between face normal and average chart normal. Higher values produce flatter charts. |
| `roundnessWeight`       | `number`  | `0.01`  | Weight for chart roundness. Higher values prefer rounder charts. |
| `straightnessWeight`    | `number`  | `6.0`   | Weight for chart boundary straightness. |
| `normalSeamWeight`      | `number`  | `4.0`   | Weight for normal seams. Values > 1000 fully respect normal seams. |
| `textureSeamWeight`     | `number`  | `0.5`   | Weight for texture seams. |
| `maxCost`               | `number`  | `2.0`   | If the total weighted metric cost exceeds this value, the chart stops growing. Lower values produce more, smaller charts. |
| `maxIterations`         | `number`  | `1`     | Number of chart growing and seeding iterations. Higher values produce better charts but take longer. |
| `useInputMeshUvs`       | `boolean` | `false` | Use the UVs provided in `MeshDeclOptions` for chart parameterization. |
| `fixWinding`            | `boolean` | `false` | Enforce consistent texture coordinate winding. |

---

### `PackOptions`

Options for chart packing, passed to [`packCharts()`](#packchartsoptions) or [`generate()`](#generatechartoptions-packoptions).

| Property             | Type      | Default | Description |
|---------------------|-----------|---------|-------------|
| `maxChartSize`      | `number`  | `0`     | Charts larger than this (in texels) will be scaled down. 0 = no limit. |
| `padding`           | `number`  | `0`     | Number of pixels to pad between charts. |
| `texelsPerUnit`     | `number`  | `0`     | Unit-to-texel scale. E.g. a 1×1 quad with `texelsPerUnit: 32` takes up ~32×32 texels. If 0, an estimated value is calculated to match the given resolution. |
| `resolution`        | `number`  | `0`     | Atlas resolution. If 0, a single atlas is generated with `texelsPerUnit` determining the size. If both `resolution` and `texelsPerUnit` are set, one or more atlases of exactly that resolution are generated. |
| `bilinear`          | `boolean` | `true`  | Leave space around charts for texels that would be sampled by bilinear filtering. |
| `blockAlign`        | `boolean` | `false` | Align charts to 4×4 blocks. Can improve packing speed. |
| `bruteForce`        | `boolean` | `false` | Use brute-force packing for best results. Slower but more space-efficient. |
| `createImage`       | `boolean` | `false` | Create the atlas image texel map, retrievable with [`getImage()`](#getimage). |
| `rotateChartsToAxis`| `boolean` | `true`  | Rotate charts to the axis of their convex hull before packing. |
| `rotateCharts`      | `boolean` | `true`  | Rotate charts to improve packing efficiency. |

---

## Output Types

### `Mesh`

Returned by [`getMesh()`](#getmeshmeshindex). Represents the output mesh with generated atlas UVs.

| Property      | Type                      | Description |
|--------------|---------------------------|-------------|
| `vertexCount`| `number`                  | Number of output vertices (≥ input vertex count due to seam splits). |
| `indexCount` | `number`                  | Number of output indices (same as input index count). |
| `chartCount` | `number`                  | Number of charts in this mesh. |
| `vertices`   | [`Vertex[]`](#vertex)     | Output vertices with atlas UVs and cross-references to input vertices. |
| `indices`    | `Uint32Array`             | Output triangle indices into the `vertices` array. |
| `charts`     | [`Chart[]`](#chart)       | Charts in this mesh. |

---

### `AtlasImage`

Returned by [`getImage()`](#getimage). A flat texel map of all sub-atlases.

| Property     | Type         | Description |
|-------------|--------------|-------------|
| `width`     | `number`     | Atlas width in texels. |
| `height`    | `number`     | Atlas height in texels. |
| `atlasCount`| `number`     | Number of sub-atlases in the buffer. |
| `data`      | `Uint32Array`| Copied pixel bitfields, length `atlasCount * width * height`. Sub-atlas `i` starts at index `i * width * height`. |

---

### `Vertex`

An output vertex in a [`Mesh`](#mesh).

| Property     | Type               | Description |
|-------------|-------------------|-------------|
| `atlasIndex`| `number`           | Sub-atlas index. `-1` if the vertex doesn't exist in any atlas. |
| `chartIndex`| `number`           | Chart index. `-1` if the vertex doesn't exist in any chart. |
| `uv`        | `[number, number]` | UV coordinates in texel space (not normalized). To get 0–1 UVs, divide by `atlas.width` and `atlas.height`. |
| `xref`      | `number`           | Index of the input vertex this output vertex originated from. Use this to map back to your original position/normal/color data. |

---

### `Chart`

A chart in the output [`Mesh`](#mesh). A chart is a connected region of the mesh surface that has been flattened into 2D UV space.

| Property     | Type           | Description |
|-------------|---------------|-------------|
| `atlasIndex`| `number`       | Sub-atlas this chart belongs to. |
| `faceCount` | `number`       | Number of faces (triangles) in this chart. |
| `type`      | [`ChartType`](#charttype) | Parameterization method used for this chart. |
| `material`  | `number`       | Material index. |
| `faces`     | `Uint32Array`  | Face (triangle) indices belonging to this chart. |

---

## Enumerations

### `ChartType`

Chart parameterization type. Accessed via `xatlas.ChartType`.

| Name        | Value | Description |
|------------|-------|-------------|
| `Planar`   | `0`   | Chart lies on a single plane. |
| `Ortho`    | `1`   | Parameterized with an orthogonal projection. |
| `LSCM`     | `2`   | Parameterized with Least Squares Conformal Map. |
| `Piecewise`| `3`   | Parameterized piecewise. |
| `Invalid`  | `4`   | Invalid chart type. |

---

### `IndexFormat`

Index buffer data format. Accessed via `xatlas.IndexFormat`.

| Name     | Value | Description |
|---------|-------|-------------|
| `UInt16`| `0`   | 16-bit unsigned indices (`Uint16Array`). |
| `UInt32`| `1`   | 32-bit unsigned indices (`Uint32Array`). |

> The index format is detected automatically from the typed array you pass to `addMesh` / `addUvMesh`. You don't need to set this manually.

---

### `AddMeshError`

Error codes returned by `addMesh()` and `addUvMesh()`. Accessed via `xatlas.AddMeshError`.

| Name                    | Value | Description |
|------------------------|-------|-------------|
| `Success`              | `0`   | No error. |
| `Error`                | `1`   | Unspecified error. |
| `IndexOutOfRange`      | `2`   | An index is ≥ vertex count. |
| `InvalidFaceVertexCount`| `3`  | Face vertex count must be ≥ 3. |
| `InvalidIndexCount`    | `4`   | Index count is not evenly divisible by 3 (triangles expected). |

Use `xatlas.addMeshErrorString(error)` to get a human-readable message.

---

### `ProgressCategory`

Progress callback stage identifiers. Accessed via `xatlas.ProgressCategory`.

| Name               | Value | Description |
|-------------------|-------|-------------|
| `AddMesh`         | `0`   | Adding and processing meshes. |
| `ComputeCharts`   | `1`   | Segmenting meshes into charts and parameterizing. |
| `PackCharts`      | `2`   | Packing charts into atlas textures. |
| `BuildOutputMeshes`| `3`  | Building the final output mesh data. |

Use `xatlas.progressCategoryString(category)` to get a human-readable name.

---

## Image Pixel Format

Atlas image texels (from [`getImage()`](#getimage)) are `uint32` bitfields, not colors. The layout matches `xatlas.h` / `xatlas_c.h`:

| Constant               | Value        | Description |
|-----------------------|--------------|-------------|
| `ImageChartIndexMask` | `0x1FFFFFFF` | Mask for the chart index. |
| `ImageHasChartIndexBit`| `0x80000000` | Set when the texel is covered by a chart. |
| `ImageIsBilinearBit`  | `0x40000000` | Set when the texel was added for bilinear filtering safety. |
| `ImageIsPaddingBit`   | `0x20000000` | Set when the texel is padding (dilated) geometry. |

The constants are available as named exports and on the initialized module (`xatlas.ImageChartIndexMask`, etc.).

### `decodeImagePixel(pixel)`

Decode a raw pixel value without doing the bit math yourself. Available as a named export and as `xatlas.decodeImagePixel`.

```ts
decodeImagePixel(pixel: number): {
  chartIndex: number;
  hasChartIndex: boolean;
  isBilinear: boolean;
  isPadding: boolean;
}
```

```js
const { chartIndex, hasChartIndex, isBilinear, isPadding } =
  xatlas.decodeImagePixel(image.data[0]);
```

Equivalent manual decoding:

```js
const chartIndex    = pixel & 0x1FFFFFFF;
const hasChartIndex = (pixel & 0x80000000) !== 0;
const isBilinear    = (pixel & 0x40000000) !== 0;
const isPadding     = (pixel & 0x20000000) !== 0;
```

> Chart indices are global across all meshes in the atlas (they match the `chartIndex` values reported by [`getMesh()`](#getmeshmeshindex)), so they are all `< atlas.chartCount`.

---

## Workers

The kernel is compiled single-threaded (`XA_MULTITHREADED=0`). Worker support
means running a whole xatlas-wasm module inside a worker, not sharing WASM
memory between threads. The package is built for the `worker` Emscripten
environment in addition to Node and browsers.

### Browser module worker

```js
// atlas-worker.js
import createXAtlas from 'xatlas-wasm';

const xatlas = await createXAtlas();
const atlas = xatlas.createAtlas();
atlas.addMesh({ positions, indices });
atlas.generate();
self.postMessage({
  width: atlas.width,
  height: atlas.height,
  vertexCount: atlas.getMesh(0).vertexCount,
});
atlas.destroy();
```

```js
// main.js
const worker = new Worker(new URL('./atlas-worker.js', import.meta.url), {
  type: 'module',
});
worker.onmessage = ({ data }) => console.log(data);
```

### Node.js worker thread

```js
// atlas-worker.mjs
import { parentPort } from 'node:worker_threads';
import createXAtlas from 'xatlas-wasm';

const xatlas = await createXAtlas();
const atlas = xatlas.createAtlas();
atlas.addMesh({ positions, indices });
atlas.generate();
parentPort.postMessage({
  width: atlas.width,
  height: atlas.height,
  vertexCount: atlas.getMesh(0).vertexCount,
});
atlas.destroy();
```

```js
// main.mjs
import { Worker } from 'node:worker_threads';

const worker = new Worker(new URL('./atlas-worker.mjs', import.meta.url));
worker.on('message', (result) => console.log(result));
worker.on('error', (error) => console.error(error));
```

The repository's `test/worker-entry.mjs` follows the Node recipe and is run by
`npm test`.

---

## Workflows

### Simple Atlas Generation

The simplest workflow — add meshes, generate, read results:

```js
const xatlas = await createXAtlas();
const atlas = xatlas.createAtlas();

// 1. Add one or more meshes
atlas.addMesh({ positions, indices });
atlas.addMesh({ positions: positions2, indices: indices2 });

// 2. Generate (computes charts + packs in one call)
atlas.generate();

// 3. Read output for each input mesh
for (let i = 0; i < atlas.meshCount; i++) {
  const mesh = atlas.getMesh(i);
  // mesh.vertices[j].uv — atlas UVs
  // mesh.vertices[j].xref — maps to input vertex index
}

// 4. Cleanup
atlas.destroy();
```

### Step-by-Step (Editor Integration)

For tools that need to tweak parameters interactively:

```js
const atlas = xatlas.createAtlas();
atlas.addMesh({ positions, indices });

// Compute charts with custom options
atlas.computeCharts({ maxIterations: 4, maxCost: 1.5 });

// Pack — can call repeatedly with different options
atlas.packCharts({ resolution: 512, padding: 1 });

// Not happy? Repack with different settings (no need to recompute charts)
atlas.packCharts({ resolution: 1024, padding: 2, bruteForce: true });

const mesh = atlas.getMesh(0);
atlas.destroy();
```

### UV Repacking

Pack existing UV meshes into a shared atlas:

```js
const atlas = xatlas.createAtlas();

// Add meshes that already have UVs
atlas.addUvMesh({ uvs: mesh1Uvs, indices: mesh1Indices });
atlas.addUvMesh({ uvs: mesh2Uvs, indices: mesh2Indices });

// Pack only (no chart computation needed)
atlas.packCharts({ resolution: 2048 });

for (let i = 0; i < atlas.meshCount; i++) {
  const mesh = atlas.getMesh(i);
  // mesh.vertices[j].uv — new packed UVs
}

atlas.destroy();
```

---

## Examples

### Node.js

```js
import createXAtlas from 'xatlas-wasm';

async function main() {
  const xatlas = await createXAtlas();
  const atlas = xatlas.createAtlas();

  // Quad: 4 vertices, 2 triangles
  const positions = new Float32Array([
    0, 0, 0,
    1, 0, 0,
    1, 1, 0,
    0, 1, 0,
  ]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);

  const err = atlas.addMesh({ positions, indices });
  if (err !== xatlas.AddMeshError.Success) {
    throw new Error(xatlas.addMeshErrorString(err));
  }

  atlas.setProgressCallback((category, progress) => {
    console.log(`${xatlas.progressCategoryString(category)}: ${progress}%`);
    return true;
  });

  atlas.generate();

  console.log(`Atlas: ${atlas.width}×${atlas.height}, ${atlas.chartCount} charts`);

  const mesh = atlas.getMesh(0);
  for (let i = 0; i < mesh.vertexCount; i++) {
    const v = mesh.vertices[i];
    const normalizedU = v.uv[0] / atlas.width;
    const normalizedV = v.uv[1] / atlas.height;
    console.log(`  vertex ${i}: uv=(${normalizedU.toFixed(3)}, ${normalizedV.toFixed(3)}) xref=${v.xref}`);
  }

  atlas.destroy();
}

main();
```

### Browser

```html
<script type="module">
  import createXAtlas from './lib/xatlas.mjs';

  const xatlas = await createXAtlas();
  const atlas = xatlas.createAtlas();

  // ... add meshes, generate, read results ...

  atlas.destroy();
</script>
```

See `example/main.mjs` for a full browser example with OBJ loading and canvas rendering.

---

## Notes

- **UV coordinates** returned by `getMesh()` are in **texel space** (not 0–1 normalized). Divide by `atlas.width` and `atlas.height` to normalize.
- **Output vertex count** is always ≥ input vertex count because UV seams require vertex duplication. Use the `xref` field to map output vertices back to your original vertex data (positions, normals, colors, etc.).
- **Output index count** always equals input index count.
- Call `destroy()` when done to avoid WASM memory leaks.
- The WASM binary ships as `dist/xatlas.wasm` beside the package entry; use
  `locateFile` or `wasmBinary` when it lives elsewhere.
- The module is thread-safe for separate atlas instances, but a single `XAtlas` instance should not be used concurrently.
- Web Workers are supported by running the whole module inside a worker; see
  [Workers](#workers). The kernel is single-threaded, so there is no shared
  WASM memory between threads.
- For best performance with large meshes, consider using `bruteForce: false` (the default) during iteration, and `bruteForce: true` only for the final pack.
