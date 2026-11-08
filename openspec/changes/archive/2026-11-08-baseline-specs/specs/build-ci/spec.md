# Spec Delta

## Purpose

Defines how the xatlas WebAssembly artifact and the npm package are built,
tested and published.

## ADDED Requirements

### Requirement: CMake and Emscripten build

The build SHALL compile the pinned upstream xatlas sources together with the C
accessor layer through CMake and Emscripten. The
Emscripten link SHALL enable `MODULARIZE=1`, `EXPORT_ES6=1`,
`EXPORT_NAME=createXAtlasModule`, `SINGLE_FILE=1`, `ALLOW_MEMORY_GROWTH=1`,
`ALLOW_TABLE_GROWTH=1`, `NO_EXIT_RUNTIME=1` and `ENVIRONMENT=web,node`.

#### Scenario: Build emits the Emscripten module and the bundle

- **WHEN** `npm run configure` and `npm run build` run in a configured checkout
- **THEN** CMake emits `dist/xatlas.mjs` as an ES module factory named `createXAtlasModule`, and esbuild emits `dist/index.mjs`

#### Scenario: Memory can grow at runtime

- **WHEN** a generated mesh exceeds the initial WASM heap
- **THEN** the module grows its memory instead of failing on allocation

### Requirement: Single-threaded kernel

The xatlas kernel SHALL be compiled with `XA_MULTITHREADED=0` and
`XATLAS_C_API=1`. The artifact SHALL NOT use pthreads or SharedArrayBuffer and
SHALL NOT require cross-origin isolation headers.

#### Scenario: Module runs without cross-origin isolation

- **WHEN** the module is loaded in a browser page without `Cross-Origin-Opener-Policy` or `Cross-Origin-Embedder-Policy` headers
- **THEN** initialization and atlas generation work because no shared-memory threading is used

### Requirement: Pinned upstream submodule

Upstream xatlas SHALL be consumed as the git submodule at `thirdparty/xatlas`,
checked out at its recorded commit. Sources under `thirdparty/xatlas` SHALL NOT
be modified in-tree.

#### Scenario: Fresh clone requires submodule initialization

- **WHEN** a checkout without initialized submodules runs `npm run configure`
- **THEN** the build fails until `git submodule update --init --recursive` provides `thirdparty/xatlas/source/xatlas/xatlas.cpp`

### Requirement: npm build scripts

`configure` SHALL run `emcmake cmake -B build -DCMAKE_BUILD_TYPE=Release`;
`build` SHALL run `cmake --build build` followed by `bundle`; `bundle` SHALL
run esbuild on the JavaScript wrapper into `dist/index.mjs` with the node
platform;
`test` SHALL run `node test/test.mjs`; and `example` SHALL serve the browser
example.

#### Scenario: Build pipeline runs in order

- **WHEN** `npm run build` runs after a successful configure
- **THEN** CMake produces `dist/xatlas.mjs`, the bundle step produces `dist/index.mjs`, and the command exits successfully

#### Scenario: Clean script fails in a fresh install

- **WHEN** `npm run clean` runs after `npm ci`
- **THEN** it exits `127` with `rimraf: not found` because `rimraf` is not a dependency

### Requirement: Node smoke test

`npm test` SHALL run `test/test.mjs`, which imports `dist/index.mjs`, adds a
four-vertex indexed quad, registers a progress callback, calls `generate()`,
and asserts that `width`, `height`, `vertexCount` and `indexCount` are
non-zero before calling `destroy()`.

#### Scenario: Smoke test passes on a built checkout

- **WHEN** `npm test` runs after a successful build
- **THEN** the script prints `All checks passed.` and exits `0`

#### Scenario: Missing build output fails without guidance

- **WHEN** `npm test` runs before `dist/index.mjs` exists
- **THEN** the import fails with a module-not-found error instead of a build-preflight message

### Requirement: Publish workflow

`.github/workflows/publish.yml` SHALL run on a published GitHub release and on
manual `workflow_dispatch`. It SHALL check out submodules, use Node.js 24,
install Emscripten, run `npm ci`, `npm run configure`, `npm run build`,
verify `dist/index.mjs` and `lib/xatlas.d.ts`, run `npm test`, and publish with
`npm publish --provenance --access public` using `id-token: write`.

#### Scenario: Published release produces an npm release

- **WHEN** a GitHub release is published
- **THEN** the workflow builds the WASM module, runs the smoke test, and publishes the package to npm with provenance

### Requirement: Toolchain is not pinned in CI

The publish workflow SHALL install Emscripten with version `latest`. It SHALL
NOT verify the toolchain against a pinned version, record the WASM digest or
report the artifact size.

#### Scenario: CI installs the latest Emscripten

- **WHEN** the publish workflow runs
- **THEN** `mymindstorm/setup-emsdk@v14` installs `latest`, although the project documentation targets Emscripten 3.1.64

### Requirement: No push or pull-request CI

The repository SHALL provide only the publish workflow. Pushes and pull
requests SHALL NOT trigger any build or test workflow.

#### Scenario: A pull request runs no checks

- **WHEN** a commit is pushed or a pull request is opened
- **THEN** no CI workflow is triggered and the smoke test runs only during a release

### Requirement: Build outputs stay untracked

`build/` and `dist/` SHALL be gitignored build outputs and SHALL NOT be
committed.

#### Scenario: Building leaves the working tree clean

- **WHEN** a consumer runs the build and then `git status`
- **THEN** `build/` and `dist/` are ignored and no generated artifact is reported as a change
