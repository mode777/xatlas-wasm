# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Toolchain is not pinned in CI`
- TO: `### Requirement: Pinned Emscripten toolchain`
- FROM: `### Requirement: No push or pull-request CI`
- TO: `### Requirement: Push and pull-request build-and-test CI`

## MODIFIED Requirements

### Requirement: npm build scripts

`configure` SHALL run `emcmake cmake -B build -DCMAKE_BUILD_TYPE=Release`.
`build` SHALL configure automatically when no configured `build/` directory
exists, then run `cmake --build build` followed by `bundle`. `bundle` SHALL run
esbuild on the JavaScript wrapper into `dist/index.mjs` with the node platform.
`clean` SHALL remove `build/` and `dist/` and exit `0` without requiring a
`rimraf` dependency. `test` SHALL run the smoke test, and `example` SHALL serve
the browser example.

#### Scenario: Build pipeline runs in order

- **WHEN** `npm run build` runs after a successful configure
- **THEN** CMake produces `dist/xatlas.mjs`, the bundle step produces `dist/index.mjs`, and the command exits successfully

#### Scenario: Build configures a fresh checkout

- **WHEN** `npm run build` runs on a fresh checkout where `build/` has no CMake cache
- **THEN** the configure step runs first, the build continues through CMake and esbuild, and the command exits `0`

#### Scenario: Clean script fails in a fresh install

- **WHEN** `npm run clean` runs after `npm ci`
- **THEN** it removes `build/` and `dist/` and exits `0`, so the former `rimraf: not found` failure does not occur

#### Scenario: Clean removes only build outputs

- **WHEN** `npm run clean` runs in a checkout with tracked sources present
- **THEN** only `build/` and `dist/` are removed and no tracked file is deleted

### Requirement: Node smoke test

`npm test` SHALL run `test/test.mjs`, which SHALL first verify that
`dist/index.mjs` exists. When it is missing, the script SHALL print a
build-preflight message naming `npm run build` and exit non-zero. When it
exists, the script SHALL import it, add a four-vertex indexed quad, register a
progress callback, call `generate()`, and assert that `width`, `height`,
`vertexCount` and `indexCount` are non-zero before calling `destroy()`.

#### Scenario: Smoke test passes on a built checkout

- **WHEN** `npm test` runs after a successful build
- **THEN** the script prints `All checks passed.` and exits `0`

#### Scenario: Missing build output fails without guidance

- **WHEN** `npm test` runs before `dist/index.mjs` exists
- **THEN** the command exits non-zero with a preflight message naming `npm run build` instead of a bare module-not-found error

### Requirement: Publish workflow

`.github/workflows/publish.yml` SHALL run on a published GitHub release and on
manual `workflow_dispatch`. It SHALL check out submodules, use Node.js 24,
install Emscripten `3.1.64` with `mymindstorm/setup-emsdk@v14`, verify that the
installed `emcc` reports exactly `3.1.64`, run `npm ci`, `npm run configure`,
`npm run build`, verify `dist/index.mjs` and `lib/xatlas.d.ts`, run `npm test`
and `npm run test:package`, compute and log the digest and size of the emitted
artifacts, record build provenance, and publish with
`npm publish --provenance --access public` using `id-token: write`.

#### Scenario: Published release produces an npm release

- **WHEN** a GitHub release is published
- **THEN** the workflow builds the WASM module, runs the smoke and package-consumer tests, and publishes the package to npm with provenance

#### Scenario: Release records toolchain and artifact provenance

- **WHEN** a release is published
- **THEN** the release records the Emscripten and Node.js versions, source commit, `thirdparty/xatlas` submodule commit, and the SHA-256 digest and size of the emitted artifacts

#### Scenario: Toolchain mismatch fails before publish

- **WHEN** the installed `emcc` does not report version `3.1.64`
- **THEN** the workflow fails before `npm publish` runs

### Requirement: Pinned Emscripten toolchain

The build and publish workflows SHALL install Emscripten `3.1.64` through
`mymindstorm/setup-emsdk@v14` and SHALL verify that the installed `emcc`
reports exactly `3.1.64` before compiling. Local build documentation SHALL
state `3.1.64` as the supported toolchain. The workflows SHALL NOT use
`latest` or another unpinned Emscripten version.

#### Scenario: CI installs the latest Emscripten

- **WHEN** a workflow requests `latest` instead of `3.1.64`
- **THEN** the toolchain verification step fails the job before configuration

#### Scenario: Pinned toolchain is used on every build

- **WHEN** any build or publish workflow runs
- **THEN** `emcc --version` reports `3.1.64` and that version is recorded in the log and provenance

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
- **THEN** the run exposes `dist/index.mjs`, `dist/xatlas.mjs` and the digest file as a downloadable artifact

## ADDED Requirements

### Requirement: Artifact digest and size reporting

Every build workflow SHALL compute the SHA-256 digest and byte size of each
emitted `dist/` artifact (`dist/index.mjs`, and `dist/xatlas.mjs` when present),
print them to the job log and step summary, and upload the digest file with the
artifact. The publish workflow SHALL record the Emscripten version, Node.js
version, source commit and `thirdparty/xatlas` submodule commit alongside the
digests as release provenance.

#### Scenario: Build reports digest and size

- **WHEN** a build workflow finishes compiling and bundling
- **THEN** the log and step summary show the SHA-256 digest and byte size of each emitted artifact, and the digest file is uploaded with the artifact

#### Scenario: Missing artifact fails digest reporting

- **WHEN** an expected `dist/` artifact is absent when digest reporting runs
- **THEN** the step fails instead of reporting an empty or partial digest

### Requirement: Packed-package consumer test

`npm run test:package` SHALL execute `scripts/test-package.mjs`, which SHALL
pack the package with `npm pack`, install the tarball into a scratch project
without registry access, run a Node consumer that generates an atlas, typecheck
a TypeScript consumer against the packaged declarations, and run a Vite
production build.

#### Scenario: Consumer test passes on a packed package

- **WHEN** `npm run test:package` runs on a built checkout
- **THEN** the tarball installs in the scratch project, the Node consumer and TypeScript typecheck pass, and the Vite production build succeeds

### Requirement: Packed-package consumer test failure handling

The consumer test SHALL fail when the tarball lacks a required entry or
declaration, when the Node consumer fails, when typechecking fails, or when the
Vite build fails, naming the failing stage and preserving the scratch directory
for inspection. Under the current `SINGLE_FILE=1` layout the Vite step SHALL
NOT require a separate `.wasm` asset.

#### Scenario: Missing declaration fails the consumer test

- **WHEN** the packed tarball does not contain `lib/xatlas.d.ts`
- **THEN** `npm run test:package` exits non-zero and names the missing file

#### Scenario: Broken consumer or bundle fails the consumer test

- **WHEN** the installed package cannot generate an atlas from the Node consumer or the Vite build fails
- **THEN** `npm run test:package` exits non-zero and preserves the scratch directory for inspection

#### Scenario: Vite build does not expect a separate WASM asset

- **WHEN** the Vite consumer build runs against the current `SINGLE_FILE=1` package
- **THEN** it succeeds and does not require a `dist/xatlas.wasm` asset to be emitted
