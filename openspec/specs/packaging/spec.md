# packaging Specification

## Purpose

Defines the published npm package: its ESM entry points, type declarations,
shipped files, runtime dependencies and supported Node.js version.

## Requirements

### Requirement: ESM-only entry point

The package SHALL declare `"type": "module"` and expose a single entry point
at `dist/index.mjs` through both `main`/`module` and the `exports` map. It
SHALL NOT provide a CommonJS build or a `require` export condition.

#### Scenario: Importing the package resolves the ESM bundle

- **WHEN** a consumer runs `import createXAtlas from 'xatlas-wasm'`
- **THEN** Node resolves `dist/index.mjs` and the default export is the `createXAtlas` factory

#### Scenario: No CommonJS entry is published

- **WHEN** a consumer inspects the package `exports` map
- **THEN** the `.` entry has only `import` and `types` conditions and there is no `require` condition or `.cjs` file

### Requirement: TypeScript declarations

The package SHALL publish `lib/xatlas.d.ts`, referenced by the `types` field
and by the `types` condition of the `exports` map. The declarations SHALL
describe the default export as
`createXAtlas(options?: CreateXAtlasOptions): Promise<XAtlasModule>` with
`wasmBinary`, `locateFile`, `print` and `printErr` options.

#### Scenario: TypeScript resolves the declarations

- **WHEN** a TypeScript consumer imports the package with `moduleResolution` set to `node16` or `bundler`
- **THEN** the compiler loads `lib/xatlas.d.ts` and types the default export as an async factory accepting optional loader options

#### Scenario: TypeScript accepts loader options

- **WHEN** a TypeScript consumer calls `createXAtlas({ wasmBinary: new Uint8Array(), locateFile: (path) => path, print: () => {}, printErr: () => {} })`
- **THEN** the compiler accepts the call

#### Scenario: TypeScript rejects a mistyped option

- **WHEN** a TypeScript consumer calls `createXAtlas({ wasmBinary: 'bytes' })`
- **THEN** the compiler reports a type error for `wasmBinary`

### Requirement: Declared package file allow-list

The `files` field SHALL list `dist/index.mjs`, `dist/xatlas.wasm`,
`lib/xatlas.d.ts`, `README.md`, `LICENSE`, `NOTICE` and `CHANGELOG.md`.

#### Scenario: Manifest declares the intended file set

- **WHEN** a consumer reads `package.json`
- **THEN** `files` contains exactly `dist/index.mjs`, `dist/xatlas.wasm`, `lib/xatlas.d.ts`, `README.md`, `LICENSE`, `NOTICE` and `CHANGELOG.md`

### Requirement: Actual tarball contents include the WASM asset

The published tarball SHALL contain `dist/index.mjs`, `dist/xatlas.wasm`,
`lib/xatlas.d.ts`, `README.md`, `LICENSE`, `NOTICE`, `CHANGELOG.md` and
`package.json`. It SHALL NOT contain `API.md` or `BUILD.md`.

#### Scenario: npm pack lists the shipped files

- **WHEN** `npm pack --dry-run` runs on the repository
- **THEN** the tarball lists `README.md`, `dist/index.mjs`, `dist/xatlas.wasm`, `lib/xatlas.d.ts`, `LICENSE`, `NOTICE`, `CHANGELOG.md` and `package.json`, and no `API.md` or `BUILD.md`

### Requirement: Package license and upstream notice

The repository SHALL contain a root `LICENSE` with the MIT license for
`xatlas-wasm` and a `NOTICE` file reproducing the upstream xatlas MIT license
and copyright. Both files SHALL be included in the published tarball.

#### Scenario: Tarball carries the license and notice

- **WHEN** the packed tarball is inspected
- **THEN** `package/LICENSE` identifies the xatlas-wasm MIT license and `package/NOTICE` identifies the upstream xatlas MIT license and copyright

#### Scenario: License and notice are readable after install

- **WHEN** the package is installed from its tarball
- **THEN** `node_modules/xatlas-wasm/LICENSE` and `node_modules/xatlas-wasm/NOTICE` exist beside the package manifest

### Requirement: Release changelog

The repository SHALL maintain `CHANGELOG.md` with an `Unreleased` section and
a section for every published version. The changelog SHALL be included in the
published tarball and SHALL contain a section for the `package.json` version.

#### Scenario: Changelog documents the current version

- **WHEN** the packed tarball is inspected
- **THEN** `package/CHANGELOG.md` is present and contains a section heading for the `package.json` version

#### Scenario: Changelog records user-visible changes

- **WHEN** a maintainer prepares a release
- **THEN** the changelog section for that version describes the user-visible changes since the previous release

### Requirement: Package manifest metadata

`package.json` SHALL set `sideEffects` to `false`, declare the `types`
condition before the `import` condition in `exports["."]`, and declare
`publishConfig.access` as `public`. It SHALL keep `engines.node` at
`>=16.0.0` unless a separate compatibility change narrows it.

#### Scenario: Manifest exposes the expected metadata

- **WHEN** a consumer reads `package.json`
- **THEN** `sideEffects` is `false`, `types` appears before `import` in `exports["."]`, `publishConfig.access` is `public`, and `engines.node` is `>=16.0.0`

#### Scenario: Manifest lists only shipped package files

- **WHEN** `npm pack --dry-run` runs
- **THEN** every file in `files` exists and no file outside `files`, `package.json` or npm's automatic metadata files is included

### Requirement: README documentation links

README links to repository documentation SHALL be absolute URLs or SHALL
target files included in the published tarball. The README SHALL NOT link to
`API.md`, `BUILD.md` or other repository-only documents with a relative path.

#### Scenario: Readme has no broken repository-relative links

- **WHEN** the packed tarball's README is scanned
- **THEN** every documentation link is absolute or resolves to a file present in the tarball

#### Scenario: API reference and build guide remain reachable

- **WHEN** a consumer reads the published README
- **THEN** the API reference and build guide links resolve to the public repository

### Requirement: Zero runtime dependencies

The package SHALL declare no runtime `dependencies`. Only build-time
`devDependencies` (esbuild) SHALL be required.

#### Scenario: Consumer installs without runtime dependencies

- **WHEN** the package is installed as a dependency
- **THEN** no runtime packages are installed on its behalf and the module loads using only Node.js and WebAssembly built-ins

### Requirement: Node.js engine range

The package SHALL declare `engines.node` as `>=16.0.0` and SHALL NOT declare a
narrower or upper-bounded range.

#### Scenario: Node 16 satisfies the engine declaration

- **WHEN** the package is installed under Node.js 16
- **THEN** the declared engine range `>=16.0.0` is satisfied
