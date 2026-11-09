# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-11-09

### Added

- Standalone `dist/xatlas.wasm` artifact loaded on demand instead of an inline
  base64 payload.
- `createXAtlas(options)` loader options: `wasmBinary`, `locateFile`, `print`
  and `printErr`.
- Worker support by loading the whole module inside a worker.
- `getImage()` atlas image accessor.
- Public showcase site with realistic unwrapping scenarios (not part of the npm
  package).

### Changed

- The package README now links to the API reference, build guide and changelog
  on the repository.
- The npm tarball now includes license, notice and changelog files.

### Fixed

- Package and release metadata checks now fail before a mismatched tag or
  incomplete tarball can be published.

## [0.1.3] - 2026-05-22

### Changed

- Inline the WebAssembly binary in the JavaScript bundle.
- Update the publish pipeline.

## [0.1.2] - 2026-04-23

### Fixed

- Prevent the publish workflow from publishing twice.

## [0.1.1] - 2026-04-23

### Added

- Initial npm publish workflow.

## [0.1.0] - 2026-04-23

### Added

- Initial `xatlas-wasm` npm release.
