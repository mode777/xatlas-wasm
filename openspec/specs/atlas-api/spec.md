# atlas-api Specification

## Purpose

Defines the runtime contract of the `XAtlas` instance: mesh input, chart and
pack options, result access, error codes, progress callbacks and the observed
behaviour of misuse in the baseline release.

## Requirements

### Requirement: Atlas creation and destruction

The module SHALL provide `createAtlas()` returning a new atlas instance with
its own WASM allocations. `destroy()` SHALL free the atlas memory and remove
any registered progress callback. Calling `destroy()` again SHALL be a no-op.

#### Scenario: Create and destroy an atlas

- **WHEN** a consumer calls `createAtlas()` and later `destroy()`
- **THEN** the atlas is created, its WASM memory is released, and a second `destroy()` completes without throwing

### Requirement: Triangle mesh input

`addMesh(options)` SHALL accept `positions` (Float32Array, flat xyz), optional
`normals` and `uvs` (Float32Array), optional `indices` (`Uint16Array` or
`Uint32Array`), optional `faceMaterialData` (`Uint32Array`) and optional
`meshCountHint` (number). It SHALL return an `AddMeshError` code where `0`
means success.

#### Scenario: Indexed quad is accepted

- **WHEN** `addMesh` receives four positions and six `Uint32Array` indices
- **THEN** it returns `AddMeshError.Success` (`0`)

#### Scenario: Non-indexed triangle is accepted

- **WHEN** `addMesh` receives positions for three vertices and no `indices`
- **THEN** it returns `AddMeshError.Success` (`0`) and treats the vertices as a non-indexed triangle

### Requirement: UV mesh input

`addUvMesh(options)` SHALL accept `uvs` (Float32Array, flat xy) plus optional
`indices` (`Uint16Array` or `Uint32Array`) and `faceMaterialData`
(`Uint32Array`). It SHALL return an `AddMeshError` code where `0` means
success.

#### Scenario: Existing UV mesh is accepted for repacking

- **WHEN** `addUvMesh` receives a UV mesh with indices
- **THEN** it returns `AddMeshError.Success` (`0`) and the atlas can be packed with `packCharts()`

### Requirement: Mesh join

`addMeshJoin()` SHALL flush pending mesh additions and return `undefined`. In
the single-threaded build `addMesh()` completes synchronously, so
`addMeshJoin()` does not block.

#### Scenario: Join after adding a mesh

- **WHEN** `addMeshJoin()` is called after `addMesh()`
- **THEN** it returns `undefined` and the atlas is ready for chart computation

### Requirement: Chart computation, packing and generation

`computeCharts(options?)` SHALL compute charts, `packCharts(options?)` SHALL
pack them, and `generate(chartOptions?, packOptions?)` SHALL perform both in
one call. Options SHALL map to the `ChartOptions` and `PackOptions` fields
declared by the package's type declarations; omitting them SHALL use xatlas
defaults.

#### Scenario: One-call generation with options

- **WHEN** `generate({ maxIterations: 4 }, { resolution: 256, padding: 1 })` is called for an added mesh
- **THEN** charts are computed, charts are packed, and the atlas reports non-zero dimensions

#### Scenario: Step-by-step charting and packing

- **WHEN** `computeCharts()` is followed by `packCharts({ resolution: 512 })`
- **THEN** chart computation and packing each complete and the atlas reports non-zero dimensions

### Requirement: Result summary getters

After packing, the atlas SHALL report `width`, `height`, `atlasCount`,
`chartCount`, `meshCount` and `texelsPerUnit`. `getUtilization(atlasIndex)`
SHALL return the normalized texel utilization of a sub-atlas.

#### Scenario: Summary values after generation

- **WHEN** a mesh has been added and `generate()` has completed
- **THEN** `width` and `height` are greater than zero, `atlasCount` is at least one, and `meshCount` equals the number of added meshes

#### Scenario: Utilization is normalized

- **WHEN** `getUtilization(i)` is called for every `i` from `0` to `atlasCount - 1`
- **THEN** each value is a number between `0` and `1`

### Requirement: Mesh result structure

`getMesh(meshIndex)` SHALL return `{ vertexCount, indexCount, chartCount,
vertices, indices, charts }`. `vertices` SHALL hold `{ atlasIndex,
chartIndex, uv: [u, v], xref }` objects, `indices` SHALL be a `Uint32Array`,
and each chart SHALL hold `{ atlasIndex, faceCount, type, material, faces }`
with `faces` a `Uint32Array`.

#### Scenario: Output mesh matches the declared shape

- **WHEN** `getMesh(0)` is called after generation
- **THEN** the result has the declared keys, `vertices.length` equals `vertexCount`, `indices.length` equals `indexCount`, and `charts.length` equals `chartCount`

### Requirement: Mesh results are copies

All arrays and objects returned by `getMesh()` SHALL be copies out of WASM
memory. Mutating them SHALL NOT affect the atlas or later calls.

#### Scenario: Mutating a result does not modify the atlas

- **WHEN** a consumer writes to the returned `indices` array and calls `getMesh()` again
- **THEN** the second result contains the original index data

### Requirement: Error codes and error strings

`AddMeshError` SHALL define `Success=0`, `Error=1`, `IndexOutOfRange=2`,
`InvalidFaceVertexCount=3` and `InvalidIndexCount=4`. `addMesh` and
`addUvMesh` SHALL return these codes, and `addMeshErrorString(error)` SHALL
return a human-readable message for a code.

#### Scenario: Out-of-range index is reported

- **WHEN** `addMesh` receives an index greater than or equal to the vertex count
- **THEN** it returns `AddMeshError.IndexOutOfRange` (`2`) and `addMeshErrorString(2)` returns a non-empty message

#### Scenario: Index count not divisible by three is reported

- **WHEN** `addMesh` receives an index array whose length is not a multiple of three
- **THEN** it returns `AddMeshError.InvalidIndexCount` (`4`)

### Requirement: Progress callback semantics

`setProgressCallback(fn)` SHALL register `fn(category, progress)` where
`progress` ranges from 0 to 100. A truthy return SHALL continue, a falsy
return SHALL cancel, `null` SHALL clear the callback, and a later call SHALL
replace the previous callback.

#### Scenario: Callback observes progress to completion

- **WHEN** a callback that returns `true` is registered and `generate()` runs
- **THEN** the callback is invoked with `ProgressCategory` values and reaches `progress === 100`, and generation completes

#### Scenario: Callback cancellation during chart computation stops generation

- **WHEN** the callback returns `false` while charts are being computed
- **THEN** generation stops early, no packed atlas is produced, and `width`, `height` and `atlasCount` remain `0`

#### Scenario: Late cancellation leaves the packed dimensions set

- **WHEN** the callback returns `false` during output-mesh building, after packing has completed
- **THEN** that phase stops early while `width`, `height` and `atlasCount` keep the packed values

#### Scenario: Clearing the callback

- **WHEN** `setProgressCallback(null)` is called
- **THEN** the previous callback is unregistered and is not invoked by later operations

### Requirement: Enumeration values

`ChartType` SHALL define `Planar=0`, `Ortho=1`, `LSCM=2`, `Piecewise=3`,
`Invalid=4`; `IndexFormat` SHALL define `UInt16=0`, `UInt32=1`; and
`ProgressCategory` SHALL define `AddMesh=0`, `ComputeCharts=1`, `PackCharts=2`,
`BuildOutputMeshes=3`.

#### Scenario: Enum members have fixed values

- **WHEN** a consumer reads `ChartType.Piecewise` and `IndexFormat.UInt32`
- **THEN** they are `3` and `1` respectively

### Requirement: Unsupported index buffer types are silently misinterpreted

Index buffers that are neither `Uint16Array` nor `Uint32Array` SHALL be
declared `Uint16` while their original bytes are copied to WASM. Such calls
SHALL return `Success`; no type error SHALL be raised.

#### Scenario: Int32Array indices corrupt the output silently

- **WHEN** `addMesh` is called with `indices: new Int32Array([0, 1, 2, 0, 2, 3])`
- **THEN** it returns `Success`, and `getMesh(0)` reports `vertexCount: 3`, `indices` `[0, 0, 1, 0, 2, 0]`, and `chartCount: 0`

### Requirement: Result handles are not bounds-checked

`getMesh(meshIndex)` and `getUtilization(atlasIndex)` SHALL NOT validate their
index and SHALL NOT check the returned mesh pointer. An out-of-range index
SHALL read WASM memory instead of raising an error.

#### Scenario: Out-of-range mesh index returns garbage

- **WHEN** `getMesh(999)` is called on an atlas that has one mesh
- **THEN** a result derived from out-of-bounds WASM memory is returned and no `RangeError` is thrown

#### Scenario: Out-of-range atlas index returns garbage

- **WHEN** `getUtilization(99)` is called on an atlas with one sub-atlas
- **THEN** a number derived from out-of-bounds WASM memory is returned and no `RangeError` is thrown

### Requirement: No use-after-destroy guard

After `destroy()` the atlas SHALL keep a null pointer. Property getters SHALL
return `0`, `getMesh()` SHALL return zero counts with empty `vertices`,
`indices` and `charts`, and no method SHALL throw for use after destroy.

#### Scenario: Reading a destroyed atlas looks like an empty result

- **WHEN** `destroy()` has been called and the consumer reads `width` and calls `getMesh(0)`
- **THEN** `width` is `0` and `getMesh(0)` returns `{ vertexCount: 0, indexCount: 0, chartCount: 0 }` with empty arrays instead of throwing

### Requirement: No atlas image accessor

`PackOptions.createImage` SHALL be accepted and forwarded to xatlas, but the
atlas SHALL NOT expose a method or property for reading the generated image.

#### Scenario: Image cannot be read through the public API

- **WHEN** `generate(undefined, { createImage: true })` completes
- **THEN** `typeof atlas.getImage` is `'undefined'` and no image data is returned by any atlas method
