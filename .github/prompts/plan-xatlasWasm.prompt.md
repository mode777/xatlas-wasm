# Plan: xatlas-wasm — Port xatlas to WebAssembly npm package

## TL;DR
Port the xatlas C++ atlas generation library to WebAssembly using Emscripten + CMake, expose it via its existing C API, and wrap it in an ergonomic JavaScript module with TypeScript definitions, packaged as an npm module (`xatlas-wasm`).

## Key Findings
- xatlas is a single-file C++ library: `xatlas.cpp` + `xatlas.h` + `xatlas_c.h`
- It has a full C API (`xatlas_c.h`) gated behind `#define XATLAS_C_API 1` — the C wrappers are already in xatlas.cpp (lines 9936–10044)
- The library uses `std::thread`, `std::mutex`, `std::atomic`, `std::condition_variable` when `XA_MULTITHREADED=1`. Emscripten supports pthreads (SharedArrayBuffer), but for maximum browser compatibility we'll compile **without** threads (`-DXA_MULTITHREADED=0`)
- No other external dependencies — xatlas.cpp is self-contained with only standard C/C++ headers
- emsdk is at `d:\WS\workbench\tests\emsdk` (one level above project root)
- The C API surface has ~17 functions covering: create/destroy, addMesh, computeCharts, packCharts, generate, options init helpers, progress callback, and string helpers
- Struct data (vertex positions, indices, UVs) must be passed through the WASM heap — the JS wrapper needs to manage heap memory allocation for mesh data

---

## Phase 1: Project scaffolding

1. **Create `package.json`** at project root
   - name: `xatlas-wasm`, type: module
   - Scripts: `configure`, `build`, `clean`
   - `main` / `module` / `types` fields pointing to dist outputs
   - `files` array for npm publishing (dist/, README)

2. **Create `.gitignore`** at project root
   - `node_modules/`, `build/`, `dist/`, `.cache/`, `*.wasm`

3. **Create project directory structure**
   ```
   src/
     xatlas_wasm.c        (thin C wrapper / Emscripten bindings)
   lib/
     xatlas.js            (JS wrapper module)
     xatlas.d.ts          (TypeScript definitions)
   CMakeLists.txt
   package.json
   .gitignore
   ```

## Phase 2: CMake + Emscripten build

4. **Create `CMakeLists.txt`** at project root
   - `cmake_minimum_required(VERSION 3.13)`
   - Set `CMAKE_TOOLCHAIN_FILE` to emsdk's `Emscripten.cmake` (handled by emcmake)
   - Define a library target from `thirdparty/xatlas/source/xatlas/xatlas.cpp`
   - Compile flags: `-DXATLAS_C_API=1`, `-DXA_MULTITHREADED=0`, `-O2`, `-flto`
   - Build output: `xatlas.js` + `xatlas.wasm` in `dist/`
   - Emscripten link flags:
     - `-s MODULARIZE=1 -s EXPORT_NAME=createXAtlas`
     - `-s EXPORTED_FUNCTIONS=[list of _xatlas* C functions]`
     - `-s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','getValue','setValue','_malloc','_free','UTF8ToString']`
     - `-s ALLOW_MEMORY_GROWTH=1`
     - `-s NO_EXIT_RUNTIME=1`
     - `-s ENVIRONMENT=web,node`
     - `-s SINGLE_FILE=0` (keep .wasm separate for efficient loading)

5. **Create `src/xatlas_wasm.c`** — thin Emscripten binding layer
   - `#include` xatlas_c.h with `XATLAS_C_API=1`
   - Expose helper functions for struct field access from JS (since Emscripten can't directly read C struct fields):
     - `xatlasAtlas_getWidth(atlas)`, `_getHeight()`, `_getAtlasCount()`, `_getChartCount()`, `_getMeshCount()`, `_getTexelsPerUnit()`, `_getMesh(atlas, index)`, `_getUtilization(atlas, index)`
     - `xatlasMesh_getVertexCount(mesh)`, `_getIndexCount()`, `_getChartCount()`, `_getVertexArray(mesh)`, `_getIndexArray(mesh)`
     - `xatlasVertex_get(vertexArray, index)` → returns struct fields
   - These accessor functions avoid the need for JS to know exact struct memory layouts
   - Mark all with `EMSCRIPTEN_KEEPALIVE`

6. **Add npm scripts** in package.json:
   - `configure`: `emcmake cmake -B build -DCMAKE_BUILD_TYPE=Release`
   - `build`: `cmake --build build && copy/move outputs to dist/`
   - `clean`: remove build/ and dist/

## Phase 3: JavaScript wrapper (`lib/xatlas.js`)

7. **Create `lib/xatlas.js`** — high-level JS API
   - Default-export an async `init()` / factory function that loads the WASM module
   - Class `XAtlas`:
     - Constructor calls `_xatlasCreate()`, stores pointer
     - `destroy()` → calls `_xatlasDestroy()`
     - `addMesh(options)` — accepts JS typed arrays (Float32Array for positions/normals/uvs, Uint16Array/Uint32Array for indices), allocates WASM heap memory, populates `xatlasMeshDecl` struct, calls `_xatlasAddMesh()`, frees temp heap memory
     - `addUvMesh(options)` — similar pattern
     - `computeCharts(options?)` — maps JS options object to `xatlasChartOptions` struct
     - `packCharts(options?)` — maps JS options object to `xatlasPackOptions` struct
     - `generate(chartOptions?, packOptions?)` — convenience combining both
     - `addMeshJoin()`
     - Getters: `width`, `height`, `atlasCount`, `chartCount`, `meshCount`, `texelsPerUnit`
     - `getMesh(index)` → returns `{ vertices: [{atlasIndex, chartIndex, uv: [u,v], xref}], indices: Uint32Array, charts: [...] }`
   - Helper: `setProgressCallback(fn)` — since function pointers can't easily cross WASM boundary, use `addFunction` from Emscripten runtime to register a JS callback
   - Enum objects mirroring C enums: `ChartType`, `IndexFormat`, `AddMeshError`, `ProgressCategory`
   - Memory management: all heap allocations for mesh data are allocated before the call and freed after — the user never touches raw pointers

8. **Key design decisions for the JS wrapper**:
   - The `addMesh()` method accepts a plain object: `{ positions: Float32Array, normals?: Float32Array, uvs?: Float32Array, indices?: Uint32Array | Uint16Array, faceIgnoreData?: Uint8Array, faceMaterialData?: Uint32Array }`
   - Return mesh data as plain JS objects with typed arrays, not raw WASM pointers
   - The module should work in both Node.js and browsers
   - Progress callback: use Emscripten `addFunction`/`removeFunction` with `-s ALLOW_TABLE_GROWTH=1`
   - `paramFunc` in ChartOptions: support passing a JS function (also via `addFunction`)

## Phase 4: TypeScript definitions (`lib/xatlas.d.ts`)

9. **Create `lib/xatlas.d.ts`** — full API type definitions
   - All enums as `const enum` or union types
   - Interface for `MeshDeclOptions`, `UvMeshDeclOptions`, `ChartOptions`, `PackOptions`
   - Interface for output: `Atlas`, `Mesh`, `Vertex`, `Chart`
   - `XAtlas` class type with all methods
   - `init()` / factory function signature
   - JSDoc comments on every member, derived from xatlas.h C++ doc comments

## Phase 5: Verification

10. **Build verification**
    - Run `npm run configure` and `npm run build` to produce `dist/xatlas.js` + `dist/xatlas.wasm`
    - Verify the .wasm file is generated and reasonable size (~200-400KB)

11. **Functional verification** — create a minimal `test/test.mjs` script:
    - Load the module
    - Create an atlas
    - Add a simple quad mesh (4 vertices, 2 triangles)
    - Call `generate()`
    - Verify output has valid width/height, vertices with UVs
    - Destroy the atlas
    - Run with Node.js

---

## Relevant Files

- `thirdparty/xatlas/source/xatlas/xatlas.cpp` — main library source, compile with `-DXATLAS_C_API=1 -DXA_MULTITHREADED=0`
- `thirdparty/xatlas/source/xatlas/xatlas.h` — C++ API (reference for doc comments)
- `thirdparty/xatlas/source/xatlas/xatlas_c.h` — C API (17 functions, all structs/enums for WASM surface)
- `thirdparty/xatlas/source/examples/example_c99.c` — reference for C API usage patterns

## Files to Create

- `CMakeLists.txt` — Emscripten build configuration
- `package.json` — npm package manifest with build scripts
- `.gitignore` — exclude build artifacts
- `src/xatlas_wasm.c` — Emscripten accessor helpers for struct fields
- `lib/xatlas.mjs` — JavaScript wrapper module
- `lib/xatlas.d.ts` — TypeScript type definitions
- `test/test.mjs` — Minimal verification test

## Decisions

- **No threading**: compile with `XA_MULTITHREADED=0` for maximum compatibility (no SharedArrayBuffer requirement). Out of scope.
- **Separate files**: JS and WASM as separate files. `init()` accepts `locateFile` for custom paths.
- **No source modification**: The C API is already in xatlas.cpp behind `XATLAS_C_API`. We only need to define it at compile time. The accessor wrapper in `src/xatlas_wasm.c` is a new file, not a modification.
- **Struct access strategy**: Use C accessor functions rather than computing struct offsets in JS. This is more robust across compiler changes and avoids struct packing issues.
- **Module format**: ES module (`.mjs`) with MODULARIZE for Emscripten output. Works in Node.js and browsers.
- **Progress callbacks**: Supported via Emscripten `addFunction` with `ALLOW_TABLE_GROWTH`. The `paramFunc` custom parameterization callback is also supported the same way.
