# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
