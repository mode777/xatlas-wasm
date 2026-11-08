# Proposal

## Why

`xatlas-wasm@0.1.3` embeds the 173 KB WASM binary as 231 KB of base64 inside the
JavaScript bundle (`SINGLE_FILE=1`). Importing the package therefore parses the
binary with the module, prevents streaming compilation and browser caching of
the `.wasm` independently, and makes the bundle larger on the wire. At the same
time `createXAtlas()` accepts no options even though `locateFile` and
`wasmBinary` are documented as planned, the Emscripten build excludes worker
environments, and the node-platform bundle forces bundlers to special-case
Node built-ins. This change implements XW-001–XW-005: a separately loaded WASM
artifact, a real loader-options contract, worker support, a bundler-neutral JS
build, and one documented artifact layout.

Measured evidence from the audit: separate glue plus WASM gzip to **75.4 KB**
(6.6 KB glue + 68.8 KB WASM) versus **102.7 KB** for the single-file bundle.

## What Changes

- **Loader/artifact:** stop setting `SINGLE_FILE=1`; the build emits
  `dist/xatlas.wasm` alongside `dist/xatlas.mjs`. The default loader resolves
  the binary beside the package module with `import.meta.url`, streams it in
  browsers when supported, and falls back to ArrayBuffer instantiation. The
  embedded layout is removed; separate WASM is the only supported layout
  (XW-001, XW-005).
- **Public API:** `createXAtlas(options?)` accepts `wasmBinary`, `locateFile`,
  `print` and `printErr`, validates their types, forwards them to the
  Emscripten factory, and rejects with an error naming `xatlas.wasm` when the
  artifact cannot be loaded. `wasmBinary` takes precedence over URL resolution
  (XW-002).
- **Workers:** build with `ENVIRONMENT=web,node,worker`, add a worker smoke test
  that generates an atlas, and document browser-worker and Node-worker usage
  (XW-003).
- **Bundling:** bundle with esbuild `--platform=neutral` and explicit
  `module`, `fs`, `path` and `url` externals. The packed-package Vite consumer
  test must emit the `.wasm` asset and must not report a Node built-in
  externalization warning (XW-004).
- **Packaging:** add `dist/xatlas.wasm` to the published `files` allow-list and
  to the tarball/consumer checks; update the TypeScript declaration for
  `createXAtlas(options?)` (XW-001, XW-002).
- **BREAKING:** consumers that relied on the package being a single JavaScript
  file must ship `dist/xatlas.wasm` beside `dist/index.mjs` or provide
  `locateFile`/`wasmBinary`. The default npm import and the atlas API are
  otherwise unchanged. The single-file build flavor is not retained.
- Update the build/workflow digest lists, smoke tests, README, API.md, BUILD.md
  and the `docs/improvements.md` status for XW-001–XW-005.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `wasm-loader`: replaces the embedded single-file, no-argument loader contract
  with a separate lazily loaded artifact, validated loader options with
  documented precedence, worker support, and an explicit missing-artifact
  failure mode.
- `packaging`: ships `dist/xatlas.wasm`, updates the file allow-list/tarball
  expectations, and declares `createXAtlas(options?)` with
  `CreateXAtlasOptions`.
- `build-ci`: changes the Emscripten environment/link flags, the neutral JS
  bundle, the worker test, the artifact digest set, and the packed-package
  consumer checks for the separate WASM asset.

## Impact

- **Build:** `CMakeLists.txt`, `package.json` (`bundle`, `test` scripts),
  `scripts/test-package.mjs`, `.github/workflows/build-wasm.yml` and
  `.github/workflows/publish.yml`.
- **Runtime API:** `lib/xatlas.mjs`, `lib/xatlas.d.ts`; `API.md` and `README.md`.
- **Tests:** `test/test.mjs` plus a new worker smoke test.
- **Docs/backlog:** `BUILD.md`, `docs/improvements.md` (XW-001–XW-005 status).
- **Package layout:** `dist/index.mjs`, `dist/xatlas.mjs` (build intermediate)
  and `dist/xatlas.wasm`; no new runtime dependencies; the single-threaded
  `XA_MULTITHREADED=0` kernel is unchanged.
- **Deliberately out of scope:** adding a root `LICENSE` and other package
  hygiene (XW-018), mesh-input validation (XW-006), object lifecycle (XW-007),
  the remaining atlas result API (XW-009–XW-011), ABI hardening (XW-012/XW-021),
  and release-flow/docs-provenance work (XW-019/XW-022/XW-023). XW-001's
  "tarball contains the license" clause is deferred to XW-018; this change
  ships the `.wasm` but not a new license file.
