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
describe the default export as `createXAtlas(): Promise<XAtlasModule>`.

#### Scenario: TypeScript resolves the declarations

- **WHEN** a TypeScript consumer imports the package with `moduleResolution` set to `node16` or `bundler`
- **THEN** the compiler loads `lib/xatlas.d.ts` and types the default export as a zero-argument async factory

### Requirement: Declared package file allow-list

The `files` field SHALL list `dist/index.mjs`, `lib/xatlas.d.ts`, `README.md`
and `LICENSE`.

#### Scenario: Manifest declares the intended file set

- **WHEN** a consumer reads `package.json`
- **THEN** `files` contains exactly `dist/index.mjs`, `lib/xatlas.d.ts`, `README.md` and `LICENSE`

### Requirement: Actual tarball contents omit the license

The published tarball SHALL contain only the files that exist and match the
allow-list. Because no root `LICENSE` file exists in the repository, the
tarball SHALL contain four files and SHALL NOT contain license text, `API.md`
or `BUILD.md`.

#### Scenario: npm pack lists the shipped files

- **WHEN** `npm pack --dry-run` runs on the repository
- **THEN** the tarball lists `README.md`, `dist/index.mjs`, `lib/xatlas.d.ts` and `package.json`, totalling four files, and no `LICENSE`

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
