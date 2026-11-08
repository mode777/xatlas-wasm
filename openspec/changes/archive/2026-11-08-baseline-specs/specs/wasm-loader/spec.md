# Spec Delta

## Purpose

Defines how the xatlas WebAssembly binary is delivered in the `xatlas-wasm`
package and how consumers initialize the module in Node.js and browsers.

## ADDED Requirements

### Requirement: Single-file embedded WASM artifact

The package SHALL deliver the WebAssembly binary inside the JavaScript module
as an embedded base64 payload. No separate `.wasm` file SHALL be published, and
initialization SHALL NOT fetch, stream or read a standalone WASM asset.

#### Scenario: Node consumer initializes without a WASM asset

- **WHEN** a Node.js process imports the package and awaits `createXAtlas()`
- **THEN** the module initializes from the embedded payload and no `.wasm` file is read from disk or the network

#### Scenario: Build output contains no standalone WASM artifact

- **WHEN** a consumer inspects the built `dist/` directory
- **THEN** it contains `xatlas.mjs` and `index.mjs` and no `xatlas.wasm`

#### Scenario: No streaming compilation path exists

- **WHEN** the module instantiates the binary
- **THEN** it uses the decoded embedded buffer because a data URI cannot be passed to `WebAssembly.instantiateStreaming()`

### Requirement: Asynchronous no-argument module factory

The package's default export SHALL be an async function `createXAtlas()` that
takes no parameters and resolves to the module object. The factory SHALL
initialize a module backed by the embedded binary.

#### Scenario: Factory called with no arguments

- **WHEN** a consumer awaits `createXAtlas()`
- **THEN** it resolves to an object exposing `createAtlas()`, `addMeshErrorString()`, `progressCategoryString()` and the enum constants

### Requirement: Loader arguments are ignored

`createXAtlas()` SHALL accept no loader options. Any argument passed at runtime
SHALL be ignored, and no argument SHALL alter WASM resolution or
instantiation. `locateFile` and `wasmBinary` are not part of the baseline
contract.

#### Scenario: Options object has no effect

- **WHEN** a consumer calls `createXAtlas({ locateFile: () => '/custom/xatlas.wasm' })` or passes `wasmBinary`
- **THEN** initialization still uses the embedded payload and the options are silently ignored

#### Scenario: TypeScript rejects an options argument

- **WHEN** a TypeScript consumer calls `createXAtlas({})` against the package's type declarations
- **THEN** the compiler reports `TS2554: Expected 0 arguments, but got 1`

### Requirement: Module exports and enumerations

The resolved module SHALL expose `createAtlas`, `addMeshErrorString`,
`progressCategoryString` and the enum constants `ChartType`, `IndexFormat`,
`AddMeshError` and `ProgressCategory`.

#### Scenario: Consumers read the enum constants from the module

- **WHEN** a consumer accesses `xatlas.AddMeshError.InvalidIndexCount` and `xatlas.ProgressCategory.BuildOutputMeshes`
- **THEN** they are the numbers `4` and `3` respectively

### Requirement: Browser and Node runtime targets

The module SHALL be built for the `web` and `node` Emscripten environments and
SHALL load as an ES module in Node.js >= 16 and current browsers. It SHALL NOT
require server MIME configuration or bundler asset rules to initialize.

#### Scenario: Browser import needs no asset configuration

- **WHEN** a browser loads the package through an ES module import
- **THEN** the module initializes without requesting a `.wasm` URL and without a MIME-type requirement

#### Scenario: Worker environments are not compiled in

- **WHEN** a consumer attempts to initialize the package inside a Web Worker on this baseline
- **THEN** worker support is absent because the build targets only `web` and `node`
