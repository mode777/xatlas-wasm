# Building xatlas-wasm

## Prerequisites

- [Emscripten SDK (emsdk)](https://emscripten.org/docs/getting_started/downloads.html)
  — the project targets and CI pins **Emscripten 3.1.64** (matching the
  `libfive-wasm` baseline). Both workflows install 3.1.64 and assert
  `emcc --version` before building, so use the same version locally.
- [CMake](https://cmake.org/) >= 3.13
- [Node.js](https://nodejs.org/) >= 18 for the development tooling (the
  published package supports >= 16); CI uses Node 24
- Git with submodule support

## Setup

1. **Install and activate emsdk 3.1.64.** The repository does not vendor
   emsdk; point the command at your checkout. If it sits next to this repo:

   ```powershell
   # PowerShell
   ..\emsdk\emsdk_env.ps1
   ```

   ```bash
   # Bash / Linux / macOS
   source ../emsdk/emsdk_env.sh
   ```

   In this workspace/container the SDK is installed at
   `~/workspace/emsdk`, so use `source ~/workspace/emsdk/emsdk_env.sh`.

2. **Initialize the submodule** (if not already done):

   ```sh
   git submodule update --init --recursive
   ```

3. **Install the JavaScript tooling**:

   ```sh
   npm ci
   ```

## Configure

```sh
npm run configure
```

This runs `emcmake cmake -B build -DCMAKE_BUILD_TYPE=Release`. You only need
to run it explicitly for an isolated configure; `npm run build` does it
automatically when `build/CMakeCache.txt` is absent (see below).

## Build

```sh
npm run build
```

The `prebuild` lifecycle hook runs `scripts/ensure-configured.mjs`, which
recreates `dist/` if needed and runs `npm run configure` when
`build/CMakeCache.txt` is missing. A clean checkout, or one where you ran
`rm -rf build dist`, therefore builds with the single command above — no
manual configure step. The build then runs CMake and bundles the JavaScript
entry with esbuild. It produces:

| Output | Contents |
|---|---|
| `dist/xatlas.mjs` | Emscripten ES module glue. With the current `SINGLE_FILE=1` setting, the WASM binary is embedded here as base64. |
| `dist/index.mjs` | The bundled npm entry point (wrapper + glue + embedded WASM). |

There is currently **no separate `dist/xatlas.wasm`**. Switching to a lazily
loaded, separately cached artifact is planned as XW-001; see
[`docs/improvements.md`](docs/improvements.md).

Running `cmake --build build` alone produces only `dist/xatlas.mjs`; use
`npm run build` when you need the publishable `dist/index.mjs`.

## Test

```sh
npm test
# or
node test/test.mjs
```

The test imports `dist/index.mjs`, so build first. If the bundle is missing it
prints `dist/index.mjs not found. Run "npm run build" first.` to stderr and
exits 1 instead of failing with a bare module error. The smoke test adds a
four-vertex quad, generates an atlas and checks the output dimensions, mesh
counts and the `getImage()` behaviour; success ends with `All checks passed.`

### Packed-package consumer test

```sh
npm run test:package
```

`scripts/test-package.mjs` packs the real npm tarball, installs it into a
scratch project under the OS temp directory (not in the repository), and then:

- checks the tarball contains `dist/index.mjs`, `lib/xatlas.d.ts`,
  `README.md` and `package.json`;
- runs a Node consumer that imports the installed package, generates an atlas
  with `createImage: true` and checks `getImage()`;
- typechecks a TypeScript consumer against the packaged declarations with the
  repository's `typescript`;
- runs a Vite production build of a consumer app and asserts it emitted and
  referenced a JS asset.

The scratch tree is removed on success and kept on failure for inspection;
`KEEP_PACKAGE_TEST=1 npm run test:package` keeps it after a successful run.
`TEST_PACKAGE_DROP=<file>` deletes a file from the installed scratch copy before
the consumers run; it is a maintainer hook for proving a broken package fails,
not part of CI.

Under the current `SINGLE_FILE=1` layout the package has no separate `.wasm`
asset, so the test intentionally does not expect one — that check arrives with
XW-001. It also does not require a root `LICENSE` in the tarball; fixing the
package contents is XW-018. Both limitations are tracked in
[`docs/improvements.md`](docs/improvements.md).

## Clean

```sh
npm run clean
```

This runs `rm -rf build dist` and exits 0 without an extra dependency. It
requires a Unix-like shell (Linux, macOS, or Git Bash/WSL on Windows); native
PowerShell/cmd has no `rm -rf`.

## npm scripts

| Command            | Description |
| ------------------ | ----------- |
| `npm run configure`| Run the emcmake CMake configure step |
| `npm run prebuild` | Internal `build` hook: configure when `build/CMakeCache.txt` is missing and ensure `dist/` exists |
| `npm run build`    | Auto-configure if needed, build WASM, then bundle into `dist/index.mjs` |
| `npm run bundle`   | Bundle `lib/xatlas.mjs` + Emscripten glue via esbuild |
| `npm test`         | Run the Node smoke test (with the `dist/index.mjs` preflight) |
| `npm run test:package` | Pack the tarball and run the Node/TypeScript/Vite consumer test |
| `npm run clean`    | Remove `build/` and `dist/` with `rm -rf` (Unix-like shell) |
| `npm run example`  | Serve the browser example on port 3000 |

## Continuous integration

Two GitHub Actions workflows pin the same toolchain as local builds:

| Workflow | Trigger | Behaviour |
|---|---|---|
| `Build WASM` (`.github/workflows/build-wasm.yml`) | pushes to `main` and all pull requests | Checks out submodules, uses Node 24, installs Emscripten 3.1.64 (asserting `emcc --version`), runs `npm ci`, configure, build, `npm test` and `npm run test:package`, then writes `dist/SHA256SUMS`/`dist/SIZES` and the job summary and uploads `dist/` as the `xatlas-wasm-dist` artifact (14-day retention). |
| `Build & Publish to npm` (`.github/workflows/publish.yml`) | published releases and `workflow_dispatch` | Runs the same pinned build and both test suites, computes the digests/sizes, generates `dist/PROVENANCE.txt` (Emscripten and Node versions, source commit, `thirdparty/xatlas` commit, digests/sizes), attaches it to the release with `gh release upload`, then runs `npm publish --provenance --access public`. |

Both workflows use `mymindstorm/setup-emsdk@v14` with `version: 3.1.64` and fail
before configure if `emcc` reports anything else. The publish job attaches
provenance before publishing, so an upload failure prevents the release.

The `build` job in `Build WASM` is intended to be a **required status check**
for `main`, so a failing run blocks a pull request from merging. That is a
repository-settings action, not a file in this repository:
GitHub → **Settings → Branches → Branch protection rules** for `main` → add
`build` under required status checks. Without that setting the workflow still
runs, but merge blocking is not enforced.

## Browser example

After building, run:

```sh
npm run example
```

Then open <http://localhost:3000/example/>. The example loads
`thirdparty/xatlas/models/gazebo.obj` by default and renders the input
wireframe next to the generated UV atlas.

## OpenSpec workflow

This repository is spec-driven. Functional changes are proposed, specified,
implemented and archived as OpenSpec changes under `openspec/changes/`; see
[`AGENTS.md`](AGENTS.md) for the full workflow and
[`docs/improvements.md`](docs/improvements.md) for the backlog.

```sh
# Validate all specs and changes (use npx if the CLI is not on PATH)
openspec validate --all --strict

# Inspect the project roots and active changes
openspec context
openspec list
```

OpenCode commands: `/opsx-propose`, `/opsx-apply`, `/opsx-archive`,
`/opsx-sync`, `/opsx-update`, `/opsx-explore`.

## Notes

- The project targets **C++17** (`CMAKE_CXX_STANDARD 17`) to support aggregate
  initialization in the upstream xatlas source without modifications.
- Threading is disabled (`XA_MULTITHREADED=0`) for the WASM build. “Worker
  support” means running the whole module inside a Web Worker, not pthreads.
- The C API is enabled (`XATLAS_C_API=1`) for use from JavaScript via the
  accessor layer in `src/xatlas_wasm.c`.
- The current build uses `SINGLE_FILE=1`; the rationale and the planned
  separate-artifact alternative are documented in the improvement backlog.
- `build/` and `dist/` are gitignored build outputs; do not commit them.
