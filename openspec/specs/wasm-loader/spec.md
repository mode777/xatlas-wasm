# wasm-loader Specification

## Purpose

Defines how the xatlas WebAssembly binary is delivered in the `xatlas-wasm`
package and how consumers initialize the module in Node.js and browsers.

## Requirements

### Requirement: Separate WASM artifact loaded on demand

The package SHALL publish a standalone `xatlas.wasm` artifact and resolve it
beside the package entry with the module URL by default. The JavaScript bundle
SHALL NOT contain an embedded base64 WASM payload, and the artifact SHALL be
loaded only when `createXAtlas()` is called.

#### Scenario: Build emits a standalone artifact

- **WHEN** `npm run build` completes
- **THEN** `dist/xatlas.wasm`, `dist/xatlas.mjs` and `dist/index.mjs` exist, and `dist/index.mjs` contains no base64 WASM payload

#### Scenario: Node loads the sibling artifact

- **WHEN** a Node.js process imports the package and awaits `createXAtlas()` with no options
- **THEN** it reads `xatlas.wasm` beside `dist/index.mjs` and resolves to a working module

#### Scenario: Browser requests the artifact over HTTP

- **WHEN** a browser loads the package from a normal HTTP origin
- **THEN** initialization requests the sibling `xatlas.wasm` instead of decoding an embedded payload

### Requirement: Asynchronous module factory with loader options

The default export SHALL be an async `createXAtlas(options?)` that resolves to
the module object. It SHALL accept `wasmBinary` (ArrayBuffer or
ArrayBufferView), `locateFile` (a function mapping artifact path and prefix to
a URL), and `print`/`printErr` (functions receiving text). No options SHALL
mean default sibling resolution.

#### Scenario: Factory called with no arguments

- **WHEN** a consumer awaits `createXAtlas()`
- **THEN** it resolves to an object exposing the existing factory methods and enum constants

#### Scenario: Factory accepts all loader options

- **WHEN** a consumer calls `createXAtlas({ wasmBinary, locateFile, print, printErr })` with correctly typed values
- **THEN** initialization succeeds without error

### Requirement: Loader option validation

Before instantiating the module, `createXAtlas()` SHALL reject with a
`TypeError` naming the offending option when `wasmBinary` is not an
ArrayBuffer or ArrayBufferView, or when `locateFile`, `print` or `printErr` is
not a function.

#### Scenario: Invalid wasmBinary is rejected

- **WHEN** `createXAtlas({ wasmBinary: 'not-bytes' })` is called
- **THEN** the promise rejects with a `TypeError` naming `wasmBinary` and no module is instantiated

#### Scenario: Invalid locateFile is rejected

- **WHEN** `createXAtlas({ locateFile: '/xatlas.wasm' })` is called
- **THEN** the promise rejects with a `TypeError` naming `locateFile`

#### Scenario: Invalid logging callback is rejected

- **WHEN** `createXAtlas({ print: 'console.log' })` is called
- **THEN** the promise rejects with a `TypeError` naming `print`

### Requirement: WASM binary precedence over URL resolution

When `wasmBinary` is supplied, the factory SHALL instantiate from those bytes
and SHALL NOT invoke `locateFile`, even when both options are present.

#### Scenario: Explicit bytes win over a locator

- **WHEN** `createXAtlas` receives valid `wasmBinary` bytes and a `locateFile` that would throw
- **THEN** initialization succeeds from the bytes and the locator is not called

#### Scenario: Custom locator resolves the artifact

- **WHEN** `createXAtlas({ locateFile })` is called without `wasmBinary`
- **THEN** `locateFile` is called with the artifact filename and prefix, and initialization uses the returned URL

### Requirement: Missing WASM artifact fails initialization

If the resolved artifact cannot be read or fetched, `createXAtlas()` SHALL
reject with an `Error` that names `xatlas.wasm` and preserves the underlying
cause. It SHALL NOT fall back to embedded WASM data.

#### Scenario: Missing sibling artifact is reported

- **WHEN** the package entry is loaded without a sibling `xatlas.wasm`
- **THEN** `createXAtlas()` rejects with an error naming `xatlas.wasm` and no module is returned

### Requirement: Module exports and enumerations

The resolved module SHALL expose `createAtlas`, `addMeshErrorString`,
`progressCategoryString` and the enum constants `ChartType`, `IndexFormat`,
`AddMeshError` and `ProgressCategory`.

#### Scenario: Consumers read the enum constants from the module

- **WHEN** a consumer accesses `xatlas.AddMeshError.InvalidIndexCount` and `xatlas.ProgressCategory.BuildOutputMeshes`
- **THEN** they are the numbers `4` and `3` respectively

### Requirement: Browser, Node and Worker runtime targets

The module SHALL be built for the `web`, `node` and `worker` Emscripten
environments and load as an ES module in Node.js >= 16, current browsers and
Web Workers. It SHALL NOT require pthreads, SharedArrayBuffer or cross-origin
isolation.

#### Scenario: Node worker generates an atlas

- **WHEN** the built package is loaded inside a Node worker thread
- **THEN** it initializes, generates an atlas for a four-vertex quad, and reports non-zero dimensions and mesh counts

#### Scenario: Worker build needs no cross-origin isolation

- **WHEN** the module runs in a worker without COOP/COEP headers
- **THEN** initialization and atlas generation work because the kernel remains single-threaded
