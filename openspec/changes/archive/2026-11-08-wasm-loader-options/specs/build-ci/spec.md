# Spec Delta

## MODIFIED Requirements

### Requirement: CMake and Emscripten build

The build SHALL compile the pinned upstream xatlas sources together with the C
accessor layer through CMake and Emscripten. The
Emscripten link SHALL enable `MODULARIZE=1`, `EXPORT_ES6=1`,
`EXPORT_NAME=createXAtlasModule`, `ALLOW_MEMORY_GROWTH=1`,
`ALLOW_TABLE_GROWTH=1`, `NO_EXIT_RUNTIME=1` and
`ENVIRONMENT=web,node,worker`. It SHALL emit `dist/xatlas.wasm` and SHALL NOT
embed the binary in the JavaScript.

#### Scenario: Build emits the Emscripten module and the bundle

- **WHEN** `npm run configure` and `npm run build` run in a configured checkout
- **THEN** CMake emits `dist/xatlas.mjs` and `dist/xatlas.wasm` as an ES module factory named `createXAtlasModule`, and esbuild emits `dist/index.mjs`

#### Scenario: Memory can grow at runtime

- **WHEN** a generated mesh exceeds the initial WASM heap
- **THEN** the module grows its memory instead of failing on allocation

### Requirement: npm build scripts

`configure` SHALL run `emcmake cmake -B build -DCMAKE_BUILD_TYPE=Release`.
`build` SHALL configure automatically when no configured `build/` directory
exists, then run `cmake --build build` followed by `bundle`. `bundle` SHALL run
esbuild on the JavaScript wrapper into `dist/index.mjs` with the neutral
platform. `clean` SHALL remove `build/` and `dist/` and exit `0` without
requiring a `rimraf` dependency. `test` SHALL run the Node smoke test, and
`example` SHALL serve the browser example.

#### Scenario: Build pipeline runs in order

- **WHEN** `npm run build` runs after a successful configure
- **THEN** CMake produces `dist/xatlas.mjs` and `dist/xatlas.wasm`, the bundle step produces `dist/index.mjs`, and the command exits successfully

#### Scenario: Build configures a fresh checkout

- **WHEN** `npm run build` runs on a fresh checkout where `build/` has no CMake cache
- **THEN** the configure step runs first, the build continues through CMake and esbuild, and the command exits `0`

#### Scenario: Clean script fails in a fresh install

- **WHEN** `npm run clean` runs after `npm ci`
- **THEN** it removes `build/` and `dist/` and exits `0`, so the former `rimraf: not found` failure does not occur

#### Scenario: Clean removes only build outputs

- **WHEN** `npm run clean` runs in a checkout with tracked sources present
- **THEN** only `build/` and `dist/` are removed and no tracked file is deleted

#### Scenario: Neutral bundle leaves Node built-ins external

- **WHEN** `npm run bundle` runs
- **THEN** `dist/index.mjs` is ESM with `module`, `fs`, `path` and `url` left external, and no Node-only platform resolution is applied

### Requirement: Node smoke test

`npm test` SHALL run `test/test.mjs`, which SHALL first verify that
`dist/index.mjs` and `dist/xatlas.wasm` exist. When either file is missing,
the script SHALL print a build-preflight message naming `npm run build` and
exit non-zero. When both exist, the script SHALL import `dist/index.mjs`, add a
four-vertex indexed quad, register a progress callback, call `generate()`, and
assert that `width`, `height`, `vertexCount` and `indexCount` are non-zero
before calling `destroy()`.

#### Scenario: Smoke test passes on a built checkout

- **WHEN** `npm test` runs after a successful build
- **THEN** the script prints `All checks passed.` and exits `0`

#### Scenario: Missing build output fails without guidance

- **WHEN** `npm test` runs before `dist/index.mjs` or `dist/xatlas.wasm` exists
- **THEN** the command exits non-zero with a preflight message naming `npm run build` instead of a bare module-not-found or missing-asset error

### Requirement: Publish workflow

`.github/workflows/publish.yml` SHALL run on a published GitHub release and on
manual `workflow_dispatch`. It SHALL check out submodules, use Node.js 24,
install Emscripten `3.1.64` and verify the installed `emcc` reports exactly
`3.1.64`, run the build, smoke test and packed-package consumer test,
verify `dist/index.mjs`, `dist/xatlas.wasm` and
`lib/xatlas.d.ts`, record artifact digests and build provenance, and publish
with `npm publish --provenance --access public` using `id-token: write`.

#### Scenario: Published release produces an npm release

- **WHEN** a GitHub release is published
- **THEN** the workflow builds the WASM module, runs the smoke, worker and package-consumer tests, and publishes the package to npm with provenance

#### Scenario: Release records toolchain and artifact provenance

- **WHEN** a release is published
- **THEN** the release records the Emscripten and Node.js versions, source commit, `thirdparty/xatlas` submodule commit, and the SHA-256 digest and size of the emitted artifacts

#### Scenario: Toolchain mismatch fails before publish

- **WHEN** the installed `emcc` does not report version `3.1.64`
- **THEN** the workflow fails before `npm publish` runs

### Requirement: Push and pull-request build-and-test CI

The repository SHALL provide `.github/workflows/build-wasm.yml`, triggered by
pushes to `main` and by pull requests. It SHALL check out submodules, use
Node.js 24, install Emscripten `3.1.64`, run `npm ci`,
`npm run configure`, `npm run build`, `npm test` and `npm run test:package`,
compute the artifact digest and size, and upload `dist/` with a digest file. A
failing job SHALL be the required status check that blocks merging a pull
request.

#### Scenario: A pull request runs no checks

- **WHEN** a pull request is opened without a completed build-and-test check
- **THEN** the required status gate blocks merge, and once the workflow runs a failing job keeps it blocked

#### Scenario: Failing build or test blocks a pull request

- **WHEN** configure, build, the smoke test, or the package-consumer test fails on a pull request
- **THEN** the workflow fails and the pull request cannot merge

#### Scenario: Build artifacts are downloadable from a run

- **WHEN** the build-and-test workflow succeeds
- **THEN** the run exposes `dist/index.mjs`, `dist/xatlas.mjs`, `dist/xatlas.wasm` and the digest file as a downloadable artifact

### Requirement: Artifact digest and size reporting

Every build workflow SHALL compute the SHA-256 digest and byte size of each
emitted `dist/` artifact (`dist/index.mjs`, `dist/xatlas.wasm`, and
`dist/xatlas.mjs` when present), print them to the job log and step summary,
and upload the digest file with the artifact. The publish workflow SHALL record
the Emscripten version, Node.js version, source commit and `thirdparty/xatlas`
submodule commit alongside the digests as release provenance.

#### Scenario: Build reports digest and size

- **WHEN** a build workflow finishes compiling and bundling
- **THEN** the log and step summary show the SHA-256 digest and byte size of each emitted artifact, and the digest file is uploaded with the artifact

#### Scenario: Missing artifact fails digest reporting

- **WHEN** an expected `dist/` artifact is absent when digest reporting runs
- **THEN** the step fails instead of reporting an empty or partial digest

### Requirement: Packed-package consumer test

`npm run test:package` SHALL execute `scripts/test-package.mjs`, which SHALL
pack the package with `npm pack`, install the tarball into a scratch project
without registry access, run a Node consumer that generates an atlas from the
packaged WASM, typecheck a TypeScript consumer against the packaged
declarations (including loader options), and run a Vite production build that
emits the WASM asset.

#### Scenario: Consumer test passes on a packed package

- **WHEN** `npm run test:package` runs on a built checkout
- **THEN** the tarball installs in the scratch project with `dist/xatlas.wasm`, the Node consumer resolves it beside the entry, the TypeScript typecheck passes, and the Vite production build emits and references the WASM asset

## REMOVED Requirements

### Requirement: Packed-package consumer test failure handling

**Reason**: The consumer test now requires and checks the separate WASM
artifact, so the old scenario that explicitly did not expect a `.wasm` asset no
longer applies.

**Migration**: Use `npm run test:package`, which now checks for
`dist/xatlas.wasm` and fails when it is missing.

## ADDED Requirements

### Requirement: Packed-package consumer WASM failure handling

The consumer test SHALL fail when the tarball lacks a required entry or
declaration (including `dist/xatlas.wasm`), when the Node consumer fails, when
typechecking fails, or when the Vite build fails, naming the failing stage and
preserving the scratch directory for inspection.

#### Scenario: Missing declaration fails the consumer test

- **WHEN** the packed tarball does not contain `lib/xatlas.d.ts`
- **THEN** `npm run test:package` exits non-zero and names the missing file

#### Scenario: Missing WASM asset fails the consumer test

- **WHEN** the packed tarball does not contain `dist/xatlas.wasm`
- **THEN** `npm run test:package` exits non-zero and names the missing artifact

#### Scenario: Broken consumer or bundle fails the consumer test

- **WHEN** the installed package cannot generate an atlas from the Node consumer or the Vite build fails
- **THEN** `npm run test:package` exits non-zero and preserves the scratch directory for inspection

### Requirement: Worker smoke test

`npm test` SHALL also run `test/worker.test.mjs`, which SHALL start a Node
worker thread, load the built package there, generate a four-vertex quad, and
return non-zero dimensions and mesh counts to the parent.

#### Scenario: Worker generates an atlas

- **WHEN** `npm test` runs after a successful build
- **THEN** the worker smoke test passes and reports non-zero atlas dimensions and mesh counts

#### Scenario: Worker failure propagates

- **WHEN** the worker fails to initialize or generate the atlas
- **THEN** the parent process exits non-zero with the worker error
