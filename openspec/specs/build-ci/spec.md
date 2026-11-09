# build-ci Specification

## Purpose

Defines how the xatlas WebAssembly artifact and the npm package are built,
tested and published.

## Requirements

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

### Requirement: Publish workflow

`.github/workflows/publish.yml` SHALL run on a published GitHub release and on
manual `workflow_dispatch`, resolve one release tag from the release or the
required `tag` input, check out that tag with submodules, run the pinned build
and test suite, verify the dist artifacts, attach provenance to the release,
and publish with `npm publish --provenance --access public` using
`id-token: write`.

#### Scenario: Published release produces an npm release

- **WHEN** a GitHub release is published
- **THEN** the workflow builds the WASM module, runs the smoke, loader, worker and package-consumer tests, and publishes the package to npm with provenance

#### Scenario: Release records toolchain and artifact provenance

- **WHEN** a release is published
- **THEN** the release records the release tag, Emscripten and Node.js versions, source commit, `thirdparty/xatlas` submodule commit, and the SHA-256 digest and size of the emitted artifacts

#### Scenario: Toolchain mismatch fails before publish

- **WHEN** the installed `emcc` does not report version `3.1.64`
- **THEN** the workflow fails before `npm publish` runs

#### Scenario: Provenance upload failure prevents publish

- **WHEN** `gh release upload` cannot attach `dist/PROVENANCE.txt` to the release
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
- **THEN** the run exposes `dist/index.mjs`, `dist/xatlas.mjs`, `dist/xatlas.wasm` and the digest file as a downloadable artifact

### Requirement: Build outputs stay untracked

`build/` and `dist/` SHALL be gitignored build outputs and SHALL NOT be
committed.

#### Scenario: Building leaves the working tree clean

- **WHEN** a consumer runs the build and then `git status`
- **THEN** `build/` and `dist/` are ignored and no generated artifact is reported as a change

### Requirement: Artifact digest and size reporting

Every build workflow SHALL compute the SHA-256 digest and byte size of each
emitted `dist/` artifact (`dist/index.mjs`, `dist/xatlas.wasm`, and
`dist/xatlas.mjs` when present), print them to the job log and step summary,
and upload the digest file with the artifact. The publish workflow SHALL record
the release tag, Emscripten version, Node.js version, source commit and
`thirdparty/xatlas` submodule commit alongside the digests as release
provenance.

#### Scenario: Build reports digest and size

- **WHEN** a build workflow finishes compiling and bundling
- **THEN** the log and step summary show the SHA-256 digest and byte size of each emitted artifact, and the digest file is uploaded with the artifact

#### Scenario: Missing artifact fails digest reporting

- **WHEN** an expected `dist/` artifact is absent when digest reporting runs
- **THEN** the step fails instead of reporting an empty or partial digest

#### Scenario: Release provenance records the tag

- **WHEN** the publish workflow generates `dist/PROVENANCE.txt`
- **THEN** the file names the resolved release tag alongside the toolchain, source and submodule commits and the artifact digests

### Requirement: Packed-package consumer test

`npm run test:package` SHALL execute `scripts/test-package.mjs`, which SHALL
pack and install the tarball into a scratch project without registry access,
run the Node, TypeScript and Vite consumers, require the complete package file
set including `LICENSE`, `NOTICE` and `CHANGELOG.md`, and assert the package
manifest metadata.

#### Scenario: Consumer test passes on a packed package

- **WHEN** `npm run test:package` runs on a built checkout
- **THEN** the tarball installs in the scratch project with `dist/xatlas.wasm`, `LICENSE`, `NOTICE` and `CHANGELOG.md`, the Node consumer resolves the WASM beside the entry, the TypeScript typecheck passes with loader options, the Vite production build emits and references the WASM asset, and the manifest metadata assertions pass

#### Scenario: External tarball can be verified

- **WHEN** `test-package.mjs` is given an existing tarball through `TEST_PACKAGE_TARBALL`
- **THEN** it skips the local `npm pack` step and runs the same install, consumer, typecheck and Vite checks against that tarball

### Requirement: Packed-package consumer WASM failure handling

The consumer test SHALL fail when the tarball lacks a required entry,
declaration, license, notice, changelog or manifest field (including
`dist/xatlas.wasm`), when the Node consumer fails, when typechecking fails, or
when the Vite build fails, naming the failing stage and preserving the scratch
directory for inspection.

#### Scenario: Missing declaration fails the consumer test

- **WHEN** the packed tarball does not contain `lib/xatlas.d.ts`
- **THEN** `npm run test:package` exits non-zero and names the missing file

#### Scenario: Missing WASM asset fails the consumer test

- **WHEN** the packed tarball does not contain `dist/xatlas.wasm`
- **THEN** `npm run test:package` exits non-zero and names the missing artifact

#### Scenario: Missing license files fail the consumer test

- **WHEN** the packed tarball does not contain `LICENSE`, `NOTICE` or `CHANGELOG.md`
- **THEN** `npm run test:package` exits non-zero and names the missing file

#### Scenario: Manifest metadata mismatch fails the consumer test

- **WHEN** `sideEffects`, the `types` condition order, `publishConfig.access`, the `files` list or `engines.node` is wrong
- **THEN** `npm run test:package` exits non-zero and names the failing manifest field

#### Scenario: Broken consumer or bundle fails the consumer test

- **WHEN** the installed package cannot generate an atlas from the Node consumer or the Vite build fails
- **THEN** `npm run test:package` exits non-zero and preserves the scratch directory for inspection

### Requirement: Release tag and changelog validation

The publish workflow SHALL fail before building when the resolved tag is not an
annotated `v<package.json version>`, when `package-lock.json` version does not
match `package.json`, when no published non-draft GitHub release exists for the
tag, or when `CHANGELOG.md` has no section for the version.

#### Scenario: Matching annotated tag proceeds

- **WHEN** the release tag is `v0.2.0`, `package.json` and `package-lock.json` are `0.2.0`, the tag is annotated, the release is published and `CHANGELOG.md` has a `0.2.0` section
- **THEN** the workflow continues to the build and test steps

#### Scenario: Tag mismatch fails before publish

- **WHEN** the release tag is `v0.2.0` and `package.json` is `0.1.3`
- **THEN** the workflow fails before building and before `npm publish`

#### Scenario: Lightweight tag fails

- **WHEN** the release tag exists but is not an annotated Git tag
- **THEN** the workflow fails before building and before `npm publish`

#### Scenario: Lockfile mismatch fails

- **WHEN** `package.json` and `package-lock.json` declare different versions
- **THEN** the workflow fails before building and before `npm publish`

#### Scenario: Missing or draft release fails

- **WHEN** the tag has no GitHub release or its release is still a draft
- **THEN** the workflow fails before building and before `npm publish`

#### Scenario: Missing changelog section fails

- **WHEN** `CHANGELOG.md` has no section for the tag's version
- **THEN** the workflow fails before building and before `npm publish`

### Requirement: Manual release dispatch

`workflow_dispatch` SHALL require a `tag` input naming an existing published
release tag and SHALL use that tag for checkout, provenance upload and
verification. It SHALL NOT fall back to the branch name or `GITHUB_REF_NAME`.

#### Scenario: Manual retry publishes an existing release

- **WHEN** a maintainer runs `workflow_dispatch` with the tag of a published release
- **THEN** the workflow checks out that tag, uploads provenance to that release and runs the publish or idempotent verification path

#### Scenario: Branch name is rejected

- **WHEN** a maintainer runs `workflow_dispatch` with `main` or another branch name instead of a release tag
- **THEN** the workflow fails before building with a clear tag-validation error

### Requirement: Idempotent npm publish

When the exact package version already exists on the public npm registry, the
publish workflow SHALL skip `npm publish`, preserve the existing version, and
continue to post-publish verification. When the version does not exist, the
workflow SHALL publish exactly once.

#### Scenario: First run publishes the version

- **WHEN** the version is absent from the registry and all release checks pass
- **THEN** the workflow publishes the package once with provenance

#### Scenario: Retry verifies without republishing

- **WHEN** the version already exists on the registry and all release checks pass
- **THEN** the workflow skips `npm publish` and proceeds to post-publish verification

### Requirement: Post-publish verification

After the publish or idempotent skip, the workflow SHALL verify the exact
version from the public npm registry within a bounded retry window, download
the registry tarball, confirm the required package files, install it in a clean
scratch project, and generate an atlas. It SHALL fail the job when any check
fails.

#### Scenario: Published version is verified

- **WHEN** the version appears on the registry and the clean-install consumer generates an atlas
- **THEN** the workflow succeeds and reports the verified version

#### Scenario: Version never appears

- **WHEN** the registry does not expose the version within the retry window
- **THEN** the workflow fails with a timeout error naming the version

#### Scenario: Registry tarball is incomplete

- **WHEN** the downloaded registry tarball lacks a required package file
- **THEN** the workflow fails and names the missing file

#### Scenario: Clean install cannot generate an atlas

- **WHEN** the registry tarball installs but the consumer cannot generate an atlas
- **THEN** the workflow fails and reports the consumer error
