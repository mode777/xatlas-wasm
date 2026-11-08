# Spec Delta

## MODIFIED Requirements

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
`lib/xatlas.d.ts`, `README.md` and `LICENSE`.

#### Scenario: Manifest declares the intended file set

- **WHEN** a consumer reads `package.json`
- **THEN** `files` contains exactly `dist/index.mjs`, `dist/xatlas.wasm`, `lib/xatlas.d.ts`, `README.md` and `LICENSE`

## REMOVED Requirements

### Requirement: Actual tarball contents omit the license

**Reason**: The tarball now ships the separate WASM artifact; the license
question is unchanged and tracked by XW-018.

**Migration**: Expect `dist/xatlas.wasm` in the tarball; do not expect a root
`LICENSE` until XW-018 lands.

## ADDED Requirements

### Requirement: Actual tarball contents include the WASM asset

The published tarball SHALL contain `dist/index.mjs`, `dist/xatlas.wasm`,
`lib/xatlas.d.ts`, `README.md` and `package.json`. Because no root `LICENSE`
file exists, it SHALL NOT contain license text, `API.md` or `BUILD.md`.

#### Scenario: npm pack lists the shipped files

- **WHEN** `npm pack --dry-run` runs on the repository
- **THEN** the tarball lists `README.md`, `dist/index.mjs`, `dist/xatlas.wasm`, `lib/xatlas.d.ts` and `package.json`, and no `LICENSE`
