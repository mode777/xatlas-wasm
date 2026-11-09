# xatlas-wasm — WASM loading review and improvement backlog

**Status:** audit / proposal  
**Date:** 2026-11-08  
**Baseline:** `main` at `4bb211e` (`xatlas-wasm@0.1.3`)  
**Reference implementation:** `mode777/libfive-wasm` at `d59d540`

This document records the review of `xatlas-wasm`, the comparison with
`libfive-wasm`, and the proposed improvement work. It is the backlog from which
OpenSpec changes are created. No behaviour was changed as part of this audit.

Each item has an `XW-###` identifier. OpenSpec proposals should reference the
IDs they implement so the document and the change history stay linked.

---

## 1. Scope and method

The review covered:

- the CMake/Emscripten build and the generated package layout;
- how the `.wasm` binary is produced, embedded, resolved and instantiated;
- the JavaScript wrapper, TypeScript declarations and public API contract;
- `npm pack` output and the publish workflow;
- the test coverage and release process;
- a direct comparison with `libfive-wasm`, which is the more mature
  WASM-package reference in the same workspace.

Verification performed against a fresh clone with the submodule initialized:

- built with Emscripten **3.1.64**;
- ran `node test/test.mjs` — passed;
- ran a Vite 7 production build of a consumer app importing the packed tarball;
- ran `npm pack` and inspected the tarball;
- benchmarked `getMesh()` on a 40k-vertex / 79k-triangle grid;
- reproduced the typed-array, use-after-free and image-API issues described
  below.

No source code or runtime behaviour was changed by the audit. Only the
gitignored `build/`, `dist/` and `node_modules/` directories were created; the
OpenSpec scaffolding and this document were added afterwards.

---

## 2. How `xatlas-wasm` loaded WASM before this change

> **Status:** this section records the pre-change `0.1.3` baseline.
> `wasm-loader-options` replaced the embedded layout with a separate
> `dist/xatlas.wasm`; see XW-001–XW-005 below.

`xatlas-wasm` did **not** fetch or stream a `.wasm` asset. The wasm binary was
embedded in the JavaScript bundle as base64.

### 2.1 Build-time embedding

`CMakeLists.txt:126` sets:

```cmake
"SHELL:-s SINGLE_FILE=1"
```

Emscripten therefore emits `dist/xatlas.mjs` with a
`data:application/octet-stream;base64,...` URI inside the generated
`findWasmBinary()` function. The wrapper imports that glue statically
(`lib/xatlas.mjs:493`), and esbuild bundles everything into
`dist/index.mjs` (`package.json:24`).

Measured on the audit build:

| Artifact | Size |
|---|---:|
| wasm binary | 173,401 bytes |
| base64 payload | 231,204 chars |
| `dist/xatlas.mjs` | 255,928 bytes |
| `dist/index.mjs` | 276,507 bytes |
| `dist/index.mjs` gzip | 102,715 bytes |
| `npm pack` tarball | 106,834 bytes |

### 2.2 Runtime path

1. `import createXAtlas from 'xatlas-wasm'` parses the 270 KB bundle,
   including the base64 string.
2. `createXAtlas()` (`lib/xatlas.mjs:499`) calls the Emscripten factory with
   **no arguments**.
3. `findWasmBinary()` returns the hardcoded data URI.
4. `getBinarySync()` decodes it with `intArrayFromBase64()`.
5. `instantiateArrayBuffer()` calls
   `WebAssembly.instantiate(arrayBuffer, imports)`.

Because the artifact is a data URI, Emscripten cannot use
`WebAssembly.instantiateStreaming()`. The wasm is also not an independently
cacheable browser asset, and importing the package parses the payload even
before `createXAtlas()` is called.

The Node branch of the Emscripten glue still exists (`await import("module")`,
`require("fs")`, `require("path")`), because
`CMakeLists.txt:125` sets `ENVIRONMENT=web,node`. The browser branch skips that
code at runtime. `worker` is not included in the environment list.

### 2.3 Loader options are documented but not implemented

`API.md:112–126` documents:

```ts
createXAtlas({ locateFile: (path) => `/static/wasm/${path}` })
```

The actual contract is:

- `lib/xatlas.mjs:499` — `createXAtlas()` accepts no parameters;
- `lib/xatlas.d.ts:316` — `CreateXAtlasOptions` is an empty interface;
- `lib/xatlas.d.ts:348` — `createXAtlas()` takes no arguments;
- the generated `findWasmBinary()` hardcodes the data URI, so `locateFile`
  could not override it even if it were forwarded.

Runtime test: passing `{ locateFile, wasmBinary }` is silently ignored and the
module still initialises from the embedded payload. TypeScript test: the same
call fails with `TS2554: Expected 0 arguments, but got 1`.

### 2.4 Browser bundling

A Vite 7 production build succeeds, but prints:

```text
[plugin vite:resolve] Module "module" has been externalized for browser
compatibility, imported by ".../xatlas-wasm/dist/index.mjs".
```

It also emits an extra ~276 KB `.mjs` module chunk. The browser path is not
broken, but the Node-oriented esbuild configuration (`--platform=node`) creates
bundler friction that `libfive-wasm` avoids with a neutral platform and
explicit externals.

---

## 3. How `libfive-wasm` loads WASM

`libfive-wasm` uses the conventional Emscripten layout:

1. `scripts/build-wasm.sh` links `dist/libfive.wasm` and an ES6 glue file.
   `SINGLE_FILE` is not used.
2. The generated glue resolves the artifact with
   `new URL("libfive.wasm", import.meta.url)`.
3. Default runtime behaviour:
   - Node reads the sibling file with `fs`;
   - browsers `fetch` it and use `WebAssembly.instantiateStreaming()`, with an
     ArrayBuffer fallback.
4. `init(options)` (`src/loader/index.ts:65–90`) validates and supports:
   - `wasmBinary` — caller-supplied `ArrayBuffer`/view, highest priority;
   - `locateWasm` — maps the artifact filename to a caller-controlled URL;
   - `debug` — lifecycle diagnostics.
5. `ENVIRONMENT=web,node,worker` (`scripts/build-wasm.sh:244`), so the same
   artifact works in Node, browsers and workers.
6. `scripts/build-js.mjs:43–70` bundles the factory into `dist/index.js` so the
   static `new URL(..., import.meta.url)` remains visible to bundlers.
7. `scripts/test-package.mjs` packs the real tarball, installs it, runs a Node
   consumer, typechecks it, and runs a Vite production build that must emit a
   `.wasm` asset.

The result is lazy wasm loading, streaming compilation, independent browser
caching, explicit override options, and worker support.

---

## 4. Comparison

| Concern | `xatlas-wasm` | `libfive-wasm` |
|---|---|---|
| WASM delivery | 173 KB base64 inside a 270 KB JS bundle | separate 1.05 MB `.wasm` + JS glue |
| Default resolution | hardcoded data URI | `new URL(..., import.meta.url)` |
| Instantiation | `WebAssembly.instantiate(ArrayBuffer)` | Node `fs` / browser fetch + streaming |
| Loader options | none; docs claim `locateFile` | `wasmBinary`, `locateWasm`, `debug` |
| Runtime targets | `web,node` | `web,node,worker` |
| Object lifetime | manual `destroy()`, silent after free | `free()` + `FinalizationRegistry` + use-after-free throws |
| Struct access | hardcoded C offsets in JS | C shim setters; JS never encodes offsets |
| Build | direct CMake; CI uses `emsdk: latest` | pinned Emscripten 3.1.64, vendored deps, release/debug flavors |
| Tests | one 104-line Node smoke test, only at publish | 19 vitest suites + smoke/interval/golden/package/consumer tests |
| CI | publish-on-release only | build/test on every push/PR + tag-gated publish |
| Package | 4 files, no root LICENSE, no changelog | dist + LICENSE + docs; pack/type/Vite consumer test |

### What `xatlas-wasm` does better

- The public API is small and the package is easy to consume.
- `SINGLE_FILE` is a legitimate choice for a 173 KB wasm: no missing/wrong-MIME
  `.wasm` deployment, and no bundler asset configuration. The problem is not
  the existence of the mode, but that the documentation promises options that
  do not work.
- The direct CMake build over a single upstream source file is much simpler
  than libfive's vendoring/patching machinery.
- `xatlas-wasm` is actually published (`0.1.3`); libfive is still pending its
  first release.

The recommendation is therefore to adopt the **patterns** from
`libfive-wasm`, not its full scale of docs, ADRs, generated bindings and
vendoring machinery.

---

## 5. Improvement backlog

### 5.1 WASM loading, artifact and bundling

#### XW-001 — Ship a separate `xatlas.wasm` and load it lazily

- **Priority:** P1
- **Where:** `CMakeLists.txt:126`, `lib/xatlas.mjs:493`, `package.json:15–24`
- **Problem:** `SINGLE_FILE=1` embeds 173 KB of wasm as 231 KB of base64 in the
  JS bundle. It prevents streaming compilation and independent browser
  caching, and forces the wasm data to be parsed with the module.
- **Proposed:**
  - build `dist/xatlas.wasm` plus `dist/xatlas.mjs`/`dist/index.mjs`;
  - resolve the artifact beside the package module (for example
    `new URL('./xatlas.wasm', import.meta.url)`);
  - keep the wrapper as the only public entry and ship the `.wasm` in `files`;
  - preserve a documented single-file build flavor if zero-config delivery is
    a product requirement.
- **Measured benefit:** separate glue + wasm gzip to **75.4 KB** versus
  **102.7 KB** for the current single-file bundle (glue 6.6 KB + wasm 68.8 KB).
- **Acceptance criteria:**
  - `npm run build` produces `dist/xatlas.wasm` and `dist/index.mjs`;
  - `dist/index.mjs` contains no base64 wasm payload;
  - Node and browser both instantiate the sibling artifact;
  - a Vite consumer build emits the wasm asset;
  - the package tarball contains the `.wasm` and the license.
- **Suggested OpenSpec change:** `wasm-loader-options`
- **Progress (2026-11-08):** implemented by the `wasm-loader-options` change.
  `SINGLE_FILE=1` was removed; the build emits `dist/xatlas.mjs` plus
  `dist/xatlas.wasm`; the wrapper resolves the sibling with Emscripten's
  `new URL('xatlas.wasm', import.meta.url)`; and the npm tarball ships the
  `.wasm`. Node, browser/Vite and worker paths are covered by tests. The
  license clause is deferred to XW-018, so the tarball does not yet contain a
  root `LICENSE`.
- **Measured after implementation (2026-11-08):** `dist/xatlas.mjs` 25,190
  bytes (6.5 KiB gzip), `dist/xatlas.wasm` 173,401 bytes (67.3 KiB gzip), and
  `dist/index.mjs` 49,938 bytes (10.8 KiB gzip). The packed tarball is 87.4 kB
  with five files. The packed-package Vite consumer emitted
  `xatlas-DTH0F__g.wasm` alongside the entry JS, reported no Node
  externalization warning, and emitted no extra `.mjs` module chunk.

#### XW-002 — Implement `createXAtlas(options)` for real

- **Priority:** P1
- **Where:** `lib/xatlas.mjs:499`, `lib/xatlas.d.ts:316–348`, `API.md:112–126`
- **Problem:** `locateFile` is documented, but the wrapper accepts no options
  and ignores whatever it receives. `wasmBinary` cannot be supplied either.
- **Proposed:**
  - accept `{ wasmBinary?, locateFile?, print?, printErr? }` and forward the
    first two to the Emscripten factory;
  - validate option types and throw a package error on misuse;
  - update the declarations and API.md to the implemented contract;
  - add tests that a custom `locateFile` is called and that `wasmBinary` wins
    over URL resolution.
- **Acceptance criteria:**
  - a consumer can initialise from an explicit `ArrayBuffer`/typed array;
  - a consumer can point the loader at a custom URL;
  - `tsc` accepts the documented call;
  - runtime tests prove the options are forwarded.
- **Suggested OpenSpec change:** `wasm-loader-options`
- **Progress (2026-11-08):** implemented. `createXAtlas(options?)` validates
  and forwards `wasmBinary`, `locateFile`, `print` and `printErr`;
  `wasmBinary` accepts `ArrayBuffer` and any `ArrayBufferView` (normalized to
  bytes) and wins over `locateFile`; invalid types reject with a `TypeError`
  naming the option. `test/loader.test.mjs` covers default resolution, a custom
  locator, binary precedence, view normalization, invalid types and a missing
  artifact. `lib/xatlas.d.ts`, `API.md` and `README.md` describe the contract.

#### XW-003 — Add Web Worker support

- **Priority:** P2
- **Where:** `CMakeLists.txt:125`, README/API docs
- **Problem:** `ENVIRONMENT=web,node` excludes workers. A worker is the
  recommended place to run atlas generation for an interactive UI.
- **Proposed:** build with `ENVIRONMENT=web,node,worker`, document the worker
  recipe, and add a worker smoke test.
- **Acceptance criteria:**
  - the artifact initialises in a `Worker`;
  - the worker test meshes a small quad and returns its atlas dimensions;
  - the README/API docs show the worker import pattern.
- **Suggested OpenSpec change:** `wasm-loader-options`
- **Progress (2026-11-08):** implemented. The link uses
  `ENVIRONMENT=web,node,worker`; `test/worker.test.mjs` runs a whole module
  inside a Node worker thread, generates a quad and returns non-zero
  dimensions and mesh counts. `README.md` and `API.md` document the browser
  module-worker and Node `worker_threads` recipes. The kernel remains
  single-threaded.

#### XW-004 — Use a bundler-neutral JS build

- **Priority:** P2
- **Where:** `package.json:24`
- **Problem:** `esbuild --platform=node` is a workaround for Emscripten's
  `import("module")`; Vite warns and emits an extra chunk.
- **Proposed:** build with `--platform=neutral` and explicit externals for
  `module`, `fs`, `path` and `url` (the libfive pattern). Add a Vite consumer
  test that imports the packed tarball.
- **Acceptance criteria:**
  - no Node-specific resolution in the browser bundle;
  - Vite emits the wasm asset without the "module externalized" warning;
  - the consumer test runs in CI.
- **Suggested OpenSpec change:** `wasm-loader-options`
- **Progress (2026-11-08):** implemented. `scripts/bundle.mjs` uses esbuild
  `platform: 'neutral'` with `module`, `fs`, `path` and `url` external, and
  rewrites Emscripten's Node-only `import("module")` to a non-literal
  specifier. The packed-package Vite consumer emits the `.wasm` asset and fails
  on the Node externalization warning.

#### XW-005 — Decide and document the single-file trade-off

- **Priority:** P3
- **Problem:** The repository contains both a "separate wasm" design (the
  original CMake setting, the `locateFile` docs and the browser notes) and the
  current "inline wasm" implementation. The rationale for the change is only
  visible in git history.
- **Proposed:** either remove the single-file mode and document the separate
  wasm as the only supported layout, or keep it as an explicit optional build
  flavor with a clear statement of its benefits and limitations.
- **Acceptance criteria:** one supported default is documented; if the optional
  flavor remains, both flavors are built and tested.
- **Suggested OpenSpec change:** `wasm-loader-options`
- **Progress (2026-11-08):** implemented. Separate `dist/xatlas.wasm` is the
  only supported layout; the optional single-file flavor was not retained.
  `BUILD.md`, `README.md` and `API.md` document the sibling artifact, the
  loader options and the worker recipes.

### 5.2 Correctness, API completeness and robustness

#### XW-006 — Validate mesh input typed arrays and lengths

- **Priority:** P1
- **Where:** `lib/xatlas.mjs:88–190`, `:200–249`
- **Problem:** any index array that is not a `Uint32Array` is treated as
  `Uint16Array` while its original bytes are copied. Reproduced with
  `Int32Array([0,1,2, 0,2,3])`: `addMesh` returns `Success`, but `getMesh(0)`
  returns 3 vertices, `indices = [0,0,1,0,2,0]` and 0 charts. Silently
  corrupted geometry is worse than an error.
- **Proposed:** accept only `Uint16Array`/`Uint32Array` for indices; validate
  `positions`, `normals`, `uvs`, `indices` and `faceMaterialData` lengths;
  validate index range; validate `meshCountHint`. Throw `TypeError`/
  `RangeError` (or return a documented error code) before crossing into wasm.
- **Acceptance criteria:**
  - an `Int32Array` (or `Float32Array`) index buffer is rejected with a clear
    error;
  - malformed lengths and out-of-range indices are rejected;
  - valid `Uint16Array`, `Uint32Array`, and the supported non-indexed path all
    continue to pass;
  - tests cover each rejection.
- **Suggested OpenSpec change:** `mesh-input-validation`

#### XW-007 — Add lifetime safety: `FinalizationRegistry` and use-after-free guards

- **Priority:** P1
- **Where:** `lib/xatlas.mjs:57–75`
- **Problem:** `destroy()` is manual. Forgetting it leaks an entire atlas.
  After `destroy()`, the wrapper still exposes a zero pointer: `atlas.width`
  returns `0` and `getMesh(0)` returns zero counts instead of failing, so
  consumers can silently use freed state.
- **Proposed:** model this on libfive's `Lifecycle`: idempotent release, a
  `FinalizationRegistry` safety net, a debug warning when GC releases an
  object, and a `requireAlive` check that throws on use after `destroy()`.
- **Acceptance criteria:**
  - `destroy()` is idempotent;
  - any method/property after `destroy()` throws a package error;
  - GC can reclaim a forgotten atlas (verified with `FinalizationRegistry`
    test hooks or a deterministic simulation);
  - no double-free or callback leak occurs.
- **Suggested OpenSpec change:** `object-lifecycle`

#### XW-008 — Expose the atlas image produced by `createImage`

- **Priority:** P2
- **Where:** `lib/xatlas.d.ts:179–182`, `API.md:426`,
  `src/xatlas_wasm.c:28–30`
- **Problem:** `PackOptions.createImage` is documented, and
  `xatlasAtlas_getImage` is exported, but the wrapper has no `getImage()`.
  Verified: `createImage: true` produces an atlas but
  `typeof atlas.getImage === 'undefined'`.
- **Proposed:** add `getImage()` (or `getImage(atlasIndex)`) returning a
  `Uint32Array` copy/view with documented ownership and the
  `xatlasImage*` bit semantics.
- **Acceptance criteria:**
  - with `createImage: true` the image is non-empty and matches
    `width × height`;
  - with `createImage: false` the documented empty/undefined result is
    returned;
  - the image lifetime relative to `destroy()` is documented and tested.
- **Progress (2026-11-08):** implemented as `getImage()` on the atlas
  instance. It returns `{ width, height, atlasCount, data }` with a copied
  `Uint32Array` of `atlasCount * width * height` texels, and `null` when no
  image exists (default `createImage: false`, or before `generate()`); the copy
  remains valid after `destroy()`. The `Image*` bit constants and
  `decodeImagePixel()` are exported from the module; `lib/xatlas.d.ts`,
  `API.md` and the browser example were updated, and the Node smoke test covers
  the null case, dimensions, chart indices, decoded flags and post-`destroy()`
  validity (`npm test` passes; committed on `main` 2026-11-08 together with the
  OpenSpec adoption). This work was delivered outside the OpenSpec workflow, so
  the archived `atlas-api` baseline still records "No atlas image accessor" and
  is now stale; `atlas-result-api` must amend that requirement and implement the
  remaining XW-009–XW-011 scope.
- **Suggested OpenSpec change:** `atlas-result-api`

#### XW-009 — Expose `faceIgnoreData`

- **Priority:** P3
- **Where:** `lib/xatlas.mjs:88–190`, `lib/xatlas.d.ts:55–68`
- **Problem:** the C `xatlasMeshDecl` supports `faceIgnoreData`, and the
  wrapper explicitly writes a null pointer for it, but there is no JS option.
- **Proposed:** add `faceIgnoreData?: Uint8Array` (length = face count) and map
  it to the struct pointer, with validation.
- **Acceptance criteria:** ignored faces are absent from charts and output;
  a test proves the flag changes the result.
- **Suggested OpenSpec change:** `atlas-result-api`

#### XW-010 — Bounds-check result handles

- **Priority:** P2
- **Where:** `lib/xatlas.mjs:350–405`
- **Problem:** `getMesh(meshIndex)` and `getUtilization(atlasIndex)` do not
  validate their index. An invalid index reads out-of-bounds wasm memory,
  returning garbage instead of an error. A null mesh pointer is also not
  handled explicitly.
- **Proposed:** validate against `meshCount`/`atlasCount`, check the returned
  pointer, and throw `RangeError`/package error.
- **Acceptance criteria:** invalid indices throw deterministically; no
  out-of-bounds reads; tests cover both APIs.
- **Suggested OpenSpec change:** `atlas-result-api`

#### XW-011 — Add a bulk/zero-copy mesh result API

- **Priority:** P2
- **Where:** `lib/xatlas.mjs:359–405`
- **Problem:** `getMesh()` makes four wasm calls per vertex and allocates one
  JS object per vertex. On a 40k-vertex / 79k-triangle grid it took ~39 ms and
  ~10 MB of JS heap. It scales poorly for production meshes.
- **Proposed:** add a flat result API, for example:
  ```js
  {
    uvs: Float32Array,        // 2 * vertexCount
    xref: Uint32Array,        // vertexCount
    atlasIndex: Int32Array,   // vertexCount
    chartIndex: Int32Array,   // vertexCount
    indices: Uint32Array,     // indexCount
    charts: ...               // optional object/chart metadata
  }
  ```
  Keep `getMesh()` as ergonomic sugar. Document whether arrays are copies or
  views and how heap growth affects views.
- **Acceptance criteria:** the flat API returns the same data as `getMesh()`;
  it does not allocate one object per vertex; a benchmark is recorded.
- **Suggested OpenSpec change:** `mesh-result-views`

#### XW-012 — Replace hardcoded C struct offsets in JS with C setters

- **Priority:** P2
- **Where:** `lib/xatlas.mjs:148–182`, `:410–476`
- **Problem:** every field offset of `xatlasMeshDecl`, `xatlasUvMeshDecl`,
  `xatlasChartOptions` and `xatlasPackOptions` is duplicated in JS comments
  and magic numbers. A struct change, alignment change or added field would
  silently corrupt memory.
- **Proposed:** add `EMSCRIPTEN_KEEPALIVE` setters in
  `src/xatlas_wasm.c` (or export `offsetof` values plus static assertions) and
  make the JS wrapper call them. This is the pattern used by libfive's
  `wasm/shim.c` and `src/ffi/structs.ts`.
- **Acceptance criteria:**
  - no struct field offsets remain hardcoded in JS;
  - every option field round-trips through a test;
  - a C-side `static_assert`/layout check fails the build if a struct changes.
- **Suggested OpenSpec change:** `abi-hardening`

#### XW-013 — Make temporary heap allocations exception-safe

- **Priority:** P2
- **Where:** `lib/xatlas.mjs:46–53`, `:109–188`, `:209–248`, `:296–318`
- **Problem:** temporary pointers are freed linearly. If a later allocation or
  struct write throws, earlier allocations leak.
- **Proposed:** build pointer lists and free them in `try/finally`; validate
  and allocate in an order that cannot leave partial state.
- **Acceptance criteria:**
  - repeated failing calls do not grow the wasm heap;
  - a forced allocation/write failure still frees all temporaries;
  - tests cover the failure paths.
- **Suggested OpenSpec change:** `abi-hardening`

#### XW-014 — Harden progress callbacks

- **Priority:** P3
- **Where:** `lib/xatlas.mjs:320–339`, `API.md:280–310`
- **Problem:** cancellation works (a callback returning `false` yields an
  empty result), but it also prints `PackCharts: ComputeCharts must be called
  first.` from xatlas; callback exceptions are not handled; there is no test
  for cancellation.
- **Proposed:** catch callback exceptions and convert them to cancellation (or
  a documented error), test the cancellation path, and optionally expose
  `setPrint` so the wrapper can silence expected xatlas diagnostics.
- **Acceptance criteria:** cancellation leaves the atlas in a documented state;
  exceptions do not corrupt the module; tests cover both.
- **Suggested OpenSpec change:** `mesh-input-validation` (or its own
  `progress-callbacks` change if it grows)

### 5.3 Build, CI, package and release

#### XW-015 — Pin the toolchain and report artifact provenance

- **Priority:** P1
- **Where:** `.github/workflows/publish.yml:28–31`, `BUILD.md`
- **Problem:** CI installs `emsdk: latest`; local builds assume whatever
  `../emsdk` is active. The wasm hash/size is not reported, so drift is
  invisible.
- **Proposed:** pin Emscripten to **3.1.64** (the libfive baseline) in CI and
  docs; print the wasm SHA-256 and size on every build; record the toolchain
  and submodule commit in the release notes; consider a `thirdparty` lock
  record.
- **Acceptance criteria:** a different Emscripten version fails the build;
  every build logs the digest/size; the release process records them.
- **Progress (2026-11-08):** implemented by the `build-ci-hardening` OpenSpec
  change. Both workflows install Emscripten 3.1.64 through
  `mymindstorm/setup-emsdk@v14` and assert `emcc --version` before building, so
  an unpinned or cached SDK fails before configure. The build and publish jobs
  write `dist/SHA256SUMS`/`dist/SIZES` for `dist/xatlas.mjs` and
  `dist/index.mjs`, print the same rows to the job summary, and the release
  job generates and attaches `dist/PROVENANCE.txt` (Emscripten, Node, source
  commit, `thirdparty/xatlas` commit, digests/sizes) before `npm publish`.
  `BUILD.md` documents the 3.1.64 pin. Remaining: a committed submodule
  lock/README is deferred to XW-022; tag/version enforcement, trusted
  publishing and a changelog to XW-019.
- **Suggested OpenSpec change:** `build-ci-hardening`

#### XW-016 — Add a push/PR build-and-test workflow

- **Priority:** P1
- **Where:** `.github/workflows/`
- **Problem:** the only workflow is `publish.yml`. Tests run for the first
  time during a release.
- **Proposed:** add `build-wasm.yml` triggered by `push`/`pull_request` that
  installs pinned Emscripten, runs `npm ci`, configure, build and test, runs
  the package consumer test, and uploads `dist/` with the artifact digest.
  Optionally add a headless browser smoke test for the example.
- **Acceptance criteria:** a failing build/test blocks a PR; the workflow is
  green on `main`; the artifact is downloadable from the run.
- **Progress (2026-11-08):** implemented by the `build-ci-hardening` OpenSpec
  change. `.github/workflows/build-wasm.yml` (`Build WASM`) runs on pushes to
  `main` and on pull requests, checks out submodules, uses Node 24, installs
  pinned Emscripten 3.1.64 with a version assertion, and runs `npm ci`,
  configure, build, `npm test`, `npm run test:package` and the digest step
  before uploading `dist/` as the `xatlas-wasm-dist` artifact (14-day
  retention). Making the `build` job a required status check is a GitHub
  branch-protection setting, not a repository file. The first `Build WASM`
  push run was green on `main` on 2026-11-08 (run 42495692316, 1m14s, every
  step green including the packed-package consumer test and the digest step,
  and the `xatlas-wasm-dist` artifact downloaded with `index.mjs`,
  `xatlas.mjs`, `SHA256SUMS` and `SIZES`); configuring the required status
  check remains the repository-settings follow-up.
- **Suggested OpenSpec change:** `build-ci-hardening`

#### XW-017 — Fix build ergonomics and the clean script

- **Priority:** P2
- **Where:** `package.json:21–27`
- **Problem:** `npm run clean` exits 127 because `rimraf` is not a dependency.
  `npm run build` fails on a fresh clone unless `npm run configure` was run
  first, and `npm test` gives an unhelpful error when `dist/index.mjs` is
  missing.
- **Proposed:** use `rm -rf build dist` (the project already assumes a Unix
  toolchain) or add `rimraf`; make `build` configure automatically when
  `build/` is absent; add a friendly preflight message to the test script.
- **Acceptance criteria:** a fresh clone can run configure/build/test/clean
  successfully; `npm run clean` exits 0.
- **Progress (2026-11-08):** implemented by the `build-ci-hardening` OpenSpec
  change. `clean` is now `rm -rf build dist` (no undeclared `rimraf`), so it
  needs a Unix-like shell — Git Bash/WSL on Windows, documented in `BUILD.md`.
  `prebuild` runs `scripts/ensure-configured.mjs`, which ensures `dist/` exists
  and configures CMake when `build/CMakeCache.txt` is absent, so a fresh or
  cleaned checkout builds with `npm run build` alone. `test/test.mjs` checks
  for `dist/index.mjs` and prints
  `dist/index.mjs not found. Run "npm run build" first.` before exiting 1.
- **Suggested OpenSpec change:** `build-ci-hardening`

#### XW-018 — Fix package contents and manifest hygiene

- **Priority:** P2
- **Where:** `package.json:8–27`, `README.md:23–26`
- **Problem:** `package.json` lists `LICENSE` in `files`, but there is no root
  `LICENSE`; `npm pack` contains only README, `dist/index.mjs`, the `.d.ts`
  and `package.json`, so the package ships no license text. README links to
  `API.md` and `BUILD.md`, which are not in the tarball, so the links break on
  npm.
- **Proposed:** add the root MIT license plus the upstream xatlas notice;
  include `API.md`/`BUILD.md` in `files` or make the README links absolute;
  add `sideEffects: false`; put the `types` condition first in `exports`;
  consider `engines: node >= 18`.
- **Acceptance criteria:** `npm pack` contains the license and the documents
  the README links to; `npm publish --dry-run` reports no missing-file
  warnings; TypeScript resolution still works.
- **Suggested OpenSpec change:** `package-release-polish`

#### XW-019 — Harden the release and publishing flow

- **Priority:** P2
- **Where:** `.github/workflows/publish.yml`
- **Problem:** the publish workflow builds and publishes without checking the
  tag against `package.json`, without a package-consumer test, and without an
  explicit auth/provenance story. There are no tags and no changelog.
- **Proposed:** fail when the pushed tag is not `v<package.json version>`; run
  the full test and package-consumer suite before publishing; use trusted
  publishing/OIDC or an explicit token; add `publishConfig`; add
  `CHANGELOG.md`; create annotated release tags; add a post-publish
  verification script.
- **Acceptance criteria:** a mismatched tag fails before `npm publish`; a
  published version can be installed and used from a clean project; the
  changelog and tag exist.
- **Suggested OpenSpec change:** `package-release-polish`

#### XW-020 — Add a package/type/bundler consumer test

- **Priority:** P2
- **Where:** `test/test.mjs`, `package.json:27`
- **Problem:** the only test imports `../dist/index.mjs` directly. It does not
  exercise the published tarball, the declarations, or a bundler, so the
  `locateFile` drift and packaging issues went unnoticed.
- **Proposed:** add a `test:package` script that runs `npm pack`, installs the
  tarball in a scratch project, runs a Node consumer, typechecks a TypeScript
  consumer, and runs a Vite production build (emitting the wasm asset once
  XW-001 lands). Model it on `libfive-wasm/scripts/test-package.mjs`.
- **Acceptance criteria:** the script passes locally and in CI; it fails on a
  missing `.wasm`, missing license, or a broken declaration.
- **Progress (2026-11-08):** **partially implemented** by the
  `build-ci-hardening` OpenSpec change. `npm run test:package` runs
  `scripts/test-package.mjs`: it packs the real tarball, checks the required
  `dist/index.mjs`, `lib/xatlas.d.ts`, `README.md` and `package.json` entries,
  installs the tarball into a scratch project under `os.tmpdir()`, runs a Node
  consumer (quad, `generate()`, `getImage()`, `destroy()`), typechecks a
  TypeScript consumer with the repository's `typescript`, and runs a Vite
  production build that must emit and reference a JS asset. The scratch tree
  is removed on success and kept on failure; `KEEP_PACKAGE_TEST=1` keeps it
  after success, and `TEST_PACKAGE_DROP=<file>` is a local negative hook (not
  used in CI). The missing-`.wasm` acceptance check landed with
  `wasm-loader-options`: the tarball must contain `dist/xatlas.wasm`, the Node
  consumer resolves it, and the Vite consumer must emit it. The missing-license
  check is deferred to XW-018: the tarball still has no root `LICENSE`.
  Remaining sub-items: XW-018 package contents, XW-019 release flow,
  XW-022 lock/provenance.
- **Suggested OpenSpec change:** `build-ci-hardening` (or
  `package-release-polish`)

#### XW-021 — Trim or wire the Emscripten export surface

- **Priority:** P3
- **Where:** `CMakeLists.txt:32–104`, `lib/xatlas.mjs`
- **Problem:** `ccall`, `cwrap`, `HEAPU16`, `HEAP32`, `HEAPF32`,
  `xatlasSetAlloc` and `xatlasSetPrint` are exported but unused by the
  wrapper; `xatlasAtlas_getImage` is exported but not exposed.
- **Proposed:** remove unused runtime methods; wire `setPrint` (logging or
  silencing) and `setAlloc` only if the wrapper supports them; expose
  `getImage` (see XW-008). Keep the export manifest explicit and reviewed.
- **Acceptance criteria:** the JS wrapper only requires exported symbols it
  uses; the wasm/glue size change is measured; the export list is documented.
- **Suggested OpenSpec change:** `abi-hardening`

#### XW-022 — Record submodule provenance and prefer upstream

- **Priority:** P3
- **Where:** `.gitmodules`
- **Problem:** the submodule points at `mode777/xatlas` at `f700c77`, which is
  exactly upstream `jpcy/xatlas` HEAD (2022-07-26). A personal fork adds
  supply-chain surface without a documented reason.
- **Proposed:** point at the upstream repository and record the pinned commit,
  date and rationale in a `thirdparty/README`/lock file, or explain why the
  fork is retained. Ensure CI checks out the submodule.
- **Acceptance criteria:** a clean clone initializes the submodule; the pin and
  its rationale are recorded; the build uses the pinned commit.
- **Suggested OpenSpec change:** `docs-provenance`

### 5.4 Documentation and maintenance

#### XW-023 — Bring the documentation in sync with the implementation

- **Priority:** P2
- **Where:** `API.md`, `README.md`, `.github/prompts/`
- **Problem:** `API.md` documented `locateFile` and `createImage` behaviour
  that the wrapper did not implement, and the README lacked the current
  limitations. The `.github/prompts/plan-fixBrowserCompatibility.prompt.md`
  references line numbers and code that no longer exist.
- **Proposed:** keep the loader and image sections in sync after
  XW-001/XW-002/XW-008; document the supported artifact layout, `SINGLE_FILE`
  decision and worker story; remove or archive the historical prompts; keep
  the README/API/BUILD links current.
- **Acceptance criteria:** every documented option is implemented and tested;
  the README links resolve on npm and GitHub; no stale plan files remain.
- **Progress (2026-11-08):** README, API.md and BUILD.md now describe the
  `0.1.3` behaviour and the planned work; both historical prompt files carry a
  superseded banner. Removal/archival of the prompts remains.
- **Suggested OpenSpec change:** `docs-provenance`

#### XW-024 — Capture baseline specs before changing behaviour

- **Priority:** P1 (process)
- **Where:** `openspec/specs/`
- **Problem:** the repository adopts OpenSpec with no baseline capability
  specs. Without one, the first loader/API change has no explicit "before"
  contract to preserve or amend.
- **Proposed:** make the first OpenSpec change a **baseline specification**
  covering the current observable behaviour:
  - loader/artifact contract (current `SINGLE_FILE` behaviour and public
    exports);
  - mesh input/output API and error codes;
  - build/package layout and supported runtimes;
  - known limitations (no options, no image accessor, manual lifetime).
  No production code changes.
- **Acceptance criteria:** `openspec validate --all --strict` passes; the
  baseline specs describe the current package, and later changes express
  deltas against them.
- **Progress (2026-11-08):** implemented. The four baseline capability specs
  (`wasm-loader`, `atlas-api`, `packaging`, `build-ci`) were authored under the
  `baseline-specs` OpenSpec change, cross-checked against the sources and
  re-verified against the audit build, synced into `openspec/specs/` and
  archived as `openspec/changes/archive/2026-11-08-baseline-specs`.
- **Suggested OpenSpec change:** `baseline-specs`

### 5.5 Showcase

#### XW-025 — Publish a showcase site

- **Priority:** P2
- **Where:** `site/`, `.github/workflows/pages.yml`,
  `.github/workflows/build-wasm.yml`
- **Problem:** the package has no public browser demonstration. The existing
  `example/` is a single-page, no-build canvas demo for one OBJ: it has no
  gallery, worker, code view, validation or deployment, so users cannot see how
  chart and packing options change a real unwrap.
- **Proposed:** add a separate Vite + TypeScript showcase under `site/` that
  consumes the local package (`file:..`) and presents six scenarios (gazebo,
  Cesium Milk Truck, town level, UV sphere, packing lab and multi-atlas). Each
  scenario page provides 3D, UV, Atlas and Code views, run statistics, the
  chart/pack recipe, and OBJ/atlas-PNG downloads. A module worker owns the
  atlas, reports progress, flattens results and destroys the atlas. Site-local
  Vitest unwraps every scenario; a `site` job in Build WASM typechecks, tests
  and builds with the Pages base path; `pages.yml` deploys the tested
  `xatlas-wasm-dist` artifact. The showcase is not part of the npm tarball.
- **Acceptance criteria:** every scenario unwraps to non-empty finite geometry
  with UVs inside the atlas; the multi-atlas scenario produces more than one
  sub-atlas; the town-level scenario adds multiple meshes and reports a mesh
  count greater than one; the production build emits a referenced hashed
  `xatlas.wasm`; CI runs the site checks on push/PR; Pages deploys from the
  tested artifact.
- **Progress (2026-11-08):** implemented by the `showcase-site` OpenSpec change.
  Six scenarios, the four views, display modes, statistics, downloads, the
  worker, site tests, the `site` CI job and the Pages workflow are in place.
  Measured production output: 173,401-byte wasm (69.53 KB gzip), 573.5 KB lazy
  demo chunk (142.9 KB gzip), 29.0 KB lazy code chunk (11.2 KB gzip).
- **Progress (2026-11-09):** the `showcase-realistic-scenarios` follow-up
  replaced cube/terrain with the Cesium Milk Truck and a multi-model town level,
  removed the fabricated gallery preview art, and taught the worker to flatten
  every `getMesh(i)` result. The town level adds 7 meshes and unwraps 7,003
  input vertices / 5,254 faces to 8,306 output vertices / 15,762 indices,
  1,066 charts and one 1069 × 1067 atlas in about 0.8 s. Production sizes:
  the demo chunk is 574,218 bytes (143.04 KB gzip), the worker chunk carrying
  the embedded geometry is 281,964 bytes (67.59 KB gzip), the entry is 265,812
  bytes (62.86 KB gzip) and the wasm remains 173,401 bytes (69.53 KB gzip).
- **Follow-ups:** the realistic-scenario subset of `showcase-gallery` is done;
  the remaining gallery work is 10–12 scenarios, filters, coverage, option
  presets, chart highlighting and UV repack. `showcase-docs` (in-site guides and
  rendered `API.md`) and `showcase-thumbnails` (captured previews) remain
  separate. File upload waits for XW-006; the stress/cancel scenario waits for
  XW-011 and XW-014.
- **Suggested OpenSpec change:** `showcase-site` (delivered) and
  `showcase-realistic-scenarios` (content refresh)

---

## 6. Proposed OpenSpec change sequence

The sequence puts the safety net (CI and pinned toolchain) before the larger
refactors, and keeps each change independently reviewable.

| # | Change name | Improvement IDs | Outcome |
|---:|---|---|---|
| 0 | `baseline-specs` | XW-024 | Current behaviour recorded as OpenSpec specs; no code changes |
| 1 | `build-ci-hardening` | XW-015, XW-016, XW-017, XW-020 | Pinned Emscripten, push/PR build+test, package consumer test, working build scripts |
| 2 | `wasm-loader-options` | XW-001–XW-005 | Separate `.wasm`, lazy/streaming loading, `wasmBinary`/`locateFile`, worker support, neutral bundling |
| 2a | `showcase-site` | XW-025 | Six-scenario public gallery, worker unwrapping, 3D/UV/atlas/code views, Pages deployment (requested out of sequence) |
| 3 | `mesh-input-validation` | XW-006, XW-014 | No silent typed-array corruption; progress cancellation covered |
| 4 | `object-lifecycle` | XW-007, XW-013 | Idempotent release, GC safety net, no use-after-free, exception-safe allocations |
| 5 | `atlas-result-api` | XW-008–XW-011 | Image accessor, `faceIgnoreData`, bounds checks, bulk mesh result API |
| 6 | `abi-hardening` | XW-012, XW-021 | C setters/offsets replace magic numbers; export surface trimmed |
| 7 | `package-release-polish` | XW-018, XW-019 | License, package contents, changelog, tag-gated verified release |
| 8 | `docs-provenance` | XW-022, XW-023 | Upstream/submodule provenance, docs synced with runtime |

**Status (2026-11-08):** `baseline-specs` is complete and archived, and the
OpenSpec adoption (scaffolding, backlog and baseline specs) plus the XW-008
`getImage()` delivery are committed on `main`. XW-008 was implemented and
verified outside OpenSpec before the `atlas-result-api` change was authored.
That change is therefore only partially delivered: the image accessor exists,
but the archived `atlas-api` baseline still says no image accessor exists, and
XW-009–XW-011 (`faceIgnoreData`, bounds-checked result handles, bulk mesh
result API) remain. `build-ci-hardening` (XW-015, XW-016, XW-017 and partial
XW-020) is implemented on `main` and archived
(`openspec/changes/archive/2026-11-08-build-ci-hardening`, with the `build-ci`
spec synced): both workflows pin
Emscripten 3.1.64, push/PR build-and-test CI runs the package consumer test,
and the build scripts and smoke-test preflight are fixed. Its GitHub-side
verification completed on 2026-11-08: the first `Build WASM` push run was
green on `main` (run 42495692316) with a downloadable `xatlas-wasm-dist`
artifact containing the build outputs and digest files; configuring the
`build` job as a required status check is the remaining repository-settings
follow-up. `wasm-loader-options` (XW-001–XW-005) is implemented and archived
(`openspec/changes/archive/2026-11-08-wasm-loader-options`, with the
`wasm-loader`, `packaging` and `build-ci` specs synced). `showcase-site`
(XW-025) is implemented out of sequence: the realistic six-scenario gallery,
worker, four views, site tests and Pages workflow are in place, and
the package loader/API is unchanged. XW-008 (`getImage()`) still needs its spec
delta in `atlas-result-api`. Every other change in the table remains
unimplemented.

### Notes on ordering

- `build-ci-hardening` should land first so every subsequent change is tested
  on push/PR and against the packed tarball.
- `wasm-loader-options` is the largest change; it accepts the option contract
  and packaging layout that the rest of the backlog assumes.
- `mesh-input-validation` and `object-lifecycle` are independent of the loader
  and can be developed in parallel if desired.
- `atlas-result-api` depends on `object-lifecycle` for view-ownership and
  after-free semantics.
- `abi-hardening` is internal and should not change the public API beyond the
  export-surface cleanup.
- `package-release-polish` should be last before a version bump; it needs the
  loader/package layout to be final.

---

## 7. Constraints for all OpenSpec changes

These are the project rules captured in `openspec/config.yaml`; they apply to
every change in the sequence.

- **Public API:** `lib/xatlas.d.ts` and `API.md` are part of the contract and
  must change together with the implementation. No undocumented options.
- **Compatibility:** keep ESM-only, Node >= 16 (revisit >= 18) and modern
  browsers working. Avoid Node-only APIs in the browser path.
- **Threading:** the kernel stays single-threaded (`XA_MULTITHREADED=0`) for
  v1. Worker support means the whole module runs in a worker, not pthreads.
- **Upstream:** do not edit `thirdparty/xatlas` sources in-tree. Wrapper and
  accessor changes live in `src/xatlas_wasm.c` and `lib/`. If an upstream
  source change is required, it must be a pinned submodule update with a
  recorded commit and rationale.
- **Toolchain:** target Emscripten **3.1.64**, identical in CI and local
  builds. If the version changes, do it as its own change with a digest
  comparison.
- **Artifacts:** `build/` and `dist/` are gitignored build outputs. Build
  logic lives in CMake/package scripts; do not commit generated artifacts.
- **Tests:** every behaviour change needs a test that fails without the
  change. The publish path must be exercised by the package consumer test, not
  only by importing `dist/index.mjs`.
- **Size/performance:** record wasm/bundle size and the `getMesh` benchmark
  when a change affects the artifact or result marshalling. Justify any
  regression.
- **Documentation:** update `docs/improvements.md` status/notes when an item
  is implemented, and update `API.md`/`README.md` in the same change.

---

## 8. Evidence and reproduction notes

### Build and smoke test

```sh
cd ~/workspace/xatlas-wasm
git submodule update --init --recursive
source ~/workspace/emsdk/emsdk_env.sh
npm ci
npm run configure
npm run build
node test/test.mjs
```

Result: `All checks passed.`

The container is musl-based and the Emscripten-bundled Node binary does not
run; the audit used a temporary `EM_CONFIG` pointing `NODE_JS` at the system
Node. This is an environment detail, not a repository issue.

### Typed-array corruption

```js
atlas.addMesh({
  positions: new Float32Array([0,0,0, 1,0,0, 0,1,0, 1,1,0]),
  indices: new Int32Array([0,1,2, 0,2,3]),
});
// addMesh returns 0 (Success)
// getMesh(0): vertexCount=3, indices=[0,0,1,0,2,0], chartCount=0
```

### Use after destroy

```js
atlas.destroy();
atlas.destroy();            // no-op
atlas.width;                // 0
atlas.getMesh(0);           // { vertexCount: 0, indexCount: 0, ... }
```

Both should throw or be explicitly documented as invalid; currently they look
like valid empty results.

### Image API

```js
atlas.generate(undefined, { createImage: true });
typeof atlas.getImage;      // "undefined"
```

### Package contents

```sh
npm pack --dry-run
# README.md
# dist/index.mjs
# lib/xatlas.d.ts
# package.json
# total files: 4
```

No `LICENSE`, `API.md` or `BUILD.md`, although `files` lists `LICENSE` and
`README.md` links to the other two.

### Build scripts

```sh
npm run clean
# sh: rimraf: not found
# exit 127
```

### WASM sizes

```sh
# current single-file bundle
gzip -9 -c dist/index.mjs | wc -c          # 102715

# separate-file experiment (same objects, SINGLE_FILE=0)
gzip -9 -c xatlas-glue.mjs | wc -c         # 6582
gzip -9 -c xatlas.wasm | wc -c             # 68811
# total: 75393
```

### Bundle warning

```text
[plugin vite:resolve] Module "module" has been externalized for browser
compatibility, imported by ".../xatlas-wasm/dist/index.mjs".
```

The build still succeeds; the warning is a symptom of `--platform=node`.

---

## 9. Non-goals

- Rewriting the wrapper in TypeScript or adopting libfive's generated
  bindings for their own sake. The current small wrapper is a strength.
- Adding pthreads/SharedArrayBuffer support in this sequence.
- Changing xatlas's atlas-generation algorithm or output semantics.
- Reproducing libfive's full OpenSpec/ADR/showcase apparatus. The
  `showcase-site` change (XW-025) deliberately adds a realistic six-scenario
  gallery; ADRs, in-site documentation and thumbnails remain separate
  follow-ups. Adopt
  the patterns that reduce risk; skip the parts that only add ceremony for a
  1,000-line wrapper.

---

## 10. OpenSpec adoption notes

OpenSpec was initialised in this repository with:

```sh
openspec init --tools opencode,agents
```

The scaffolding is:

```text
openspec/
  config.yaml          project context and per-artifact rules
  specs/               canonical capability specs (baseline first)
  changes/             active change proposals
  changes/archive/     completed and archived changes
.opencode/commands/    /opsx-* workflow commands
.opencode/skills/      OpenSpec skills
.agents/skills/        shared OpenSpec skills
AGENTS.md              repository-specific OpenSpec workflow contract
```

`baseline-specs` is archived and `openspec validate --all --strict` passes for
the four baseline capabilities (`wasm-loader`, `atlas-api`, `packaging`,
`build-ci`). `build-ci-hardening` and `wasm-loader-options` are implemented and
archived. `showcase-site` (XW-025) is implemented out of sequence and pending
review/archive; its `showcase-site` spec delta will become the fifth capability
when archived. The next behaviour-changing item after it remains
`mesh-input-validation`. XW-008 was delivered outside the workflow and still
needs a spec delta (see §6). `README.md`, `API.md`, `BUILD.md` and
`site/README.md` describe the separate `.wasm` layout, loader options and the
showcase; they should be updated again as each item lands.

The intended workflow for each item above is:

```text
/opsx-propose "<change name>"   → proposal, specs, design, tasks
/opsx-apply   "<change name>"   → implementation
/opsx-archive "<change name>"  → sync specs and archive
```

Validate the repository with:

```sh
openspec validate --all --strict
```

Start with `baseline-specs`, then follow the sequence in section 6.
