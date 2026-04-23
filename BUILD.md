# Building xatlas-wasm

## Prerequisites

- [Emscripten SDK (emsdk)](https://emscripten.org/docs/getting_started/downloads.html)
- [CMake](https://cmake.org/) >= 3.13
- [Node.js](https://nodejs.org/) (for running tests and the example)

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

## Configure

```sh
emcmake cmake -B build -DCMAKE_BUILD_TYPE=Release
```

## Build

```sh
cmake --build build
```

This produces `dist/xatlas.mjs` and `dist/xatlas.wasm`.

## Test

```sh
node test/test.mjs
```

## Clean

```sh
rm -rf build dist
```

## npm scripts

All of the above are also available as npm scripts:

| Command            | Description                         |
| ------------------ | ----------------------------------- |
| `npm run configure`| Run emcmake cmake configure step    |
| `npm run build`    | Build the WASM module               |
| `npm test`         | Run the test suite                  |
| `npm run clean`    | Remove build and dist directories   |
| `npm run example`  | Serve the example app on port 3000  |

## Notes

- The project targets **C++17** (`CMAKE_CXX_STANDARD 17`) to support aggregate initialization in the upstream xatlas source without modifications.
- Threading is disabled (`XA_MULTITHREADED=0`) for the WASM build.
- The C API is enabled (`XATLAS_C_API=1`) for use from JavaScript via Emscripten bindings.
