# Building xatlas-wasm

## Prerequisites

- [Emscripten SDK (emsdk)](https://emscripten.org/docs/getting_started/downloads.html)
  — the project targets **Emscripten 3.1.64** (matching the `libfive-wasm`
  baseline). CI currently installs `latest`; pinning it is tracked as XW-015.
- [CMake](https://cmake.org/) >= 3.13
- [Node.js](https://nodejs.org/) >= 16 (for the build wrapper, tests and the
  example)
- Git with submodule support

## Setup

1. **Install and activate emsdk** (assumed at `../emsdk` relative to this repo):

   ```powershell
   # PowerShell
   ..\emsdk\emsdk_env.ps1
   ```

   ```bash
   # Bash / Linux / macOS
   source ../emsdk/emsdk_env.sh
   ```

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

This runs `emcmake cmake -B build -DCMAKE_BUILD_TYPE=Release`.

## Build

```sh
npm run build
```

The build runs CMake and then bundles the JavaScript entry with esbuild. It
produces:

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
node test/test.mjs
# or
npm test
```

The test imports `dist/index.mjs`, so build first. The current suite is a
single quad smoke test; broader validation, CI and a packed-package consumer
test are planned as XW-016/XW-020.

## Clean

```sh
rm -rf build dist
```

> `npm run clean` currently fails in a fresh install because `rimraf` is not a
> dependency (XW-017). Use the `rm -rf` command above until that is fixed.

## npm scripts

| Command            | Description |
| ------------------ | ----------- |
| `npm run configure`| Run the emcmake CMake configure step |
| `npm run build`    | Build WASM + bundle into `dist/index.mjs` |
| `npm run bundle`   | Bundle `lib/xatlas.mjs` + Emscripten glue via esbuild |
| `npm test`         | Run the Node smoke test |
| `npm run clean`    | Remove `build/` and `dist/` (currently requires `rimraf`; see XW-017) |
| `npm run example`  | Serve the browser example on port 3000 |

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
[`AGENTS.md`](../AGENTS.md) for the full workflow and
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
