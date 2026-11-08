# Design

## Context

See `proposal.md` for motivation. Current implementation points:

- `CMakeLists.txt` links the executable with `SINGLE_FILE=1` and
  `ENVIRONMENT=web,node`; CMake writes `dist/xatlas.mjs`, and
  `npm run bundle` uses esbuild `--platform=node` to write `dist/index.mjs`.
- `lib/xatlas.mjs` statically imports `../dist/xatlas.mjs` and
  `createXAtlas()` forwards no options.
- `lib/xatlas.d.ts` declares an empty `CreateXAtlasOptions` and a
  zero-argument `createXAtlas()`.
- `scripts/test-package.mjs` packs the tarball, runs Node/TypeScript
  consumers, and builds a Vite app; it currently expects no `.wasm` asset.
- Both workflows digest `dist/xatlas.mjs` and `dist/index.mjs`.

Emscripten 3.1.64 is pinned. Its ES module output resolves the default WASM
URL with `new URL('xatlas.wasm', import.meta.url)` when `SINGLE_FILE` is off
and no `locateFile` option is supplied; that static expression is what Vite
turns into a hashed asset. When `locateFile` is supplied, Emscripten calls it
instead, so bundlers can no longer see the asset.

The reference implementation in `~/workspace/libfive-wasm` uses the same
pattern: separate `libfive.wasm`, esbuild `platform: 'neutral'`, and externals
`module`, `fs`, `path`, `url`. Measured xatlas audit numbers: separate glue
plus WASM gzip to 75.4 KB (6.6 KB glue + 68.8 KB WASM) versus 102.7 KB for the
single-file bundle.

## Goals / Non-Goals

**Goals:**

- One supported layout: `dist/index.mjs` + sibling `dist/xatlas.wasm`.
- Default Node, browser and worker initialization without loader options.
- A validated options contract with explicit precedence and a useful failure
  when the artifact is missing.
- A neutral JavaScript bundle whose Vite consumer emits the WASM asset without
  a Node built-in externalization warning.
- Keep the atlas API, typed-array ownership and single-threaded kernel
  unchanged.

**Non-Goals:**

- Retaining a single-file build flavor (XW-005 chooses one layout).
- Adding pthreads, SharedArrayBuffer or cross-origin-isolation requirements.
- Changing `getMesh()`/`getImage()` ownership, lifetime or the public atlas
  API; the existing copy semantics remain.
- Adding the root `LICENSE` (XW-018), changelog/tag enforcement (XW-019) or
  other package hygiene.

## Decisions

### D1 — Remove `SINGLE_FILE` and publish `dist/xatlas.wasm` as the only layout

Remove `SINGLE_FILE=1` from the CMake link options. CMake then emits
`dist/xatlas.mjs` + `dist/xatlas.wasm`; esbuild bundles the glue into
`dist/index.mjs`. The package `files` allow-list adds `dist/xatlas.wasm`.
`dist/xatlas.mjs` remains a build intermediate for inspection but is not
published because its contents are bundled into `index.mjs`.

Alternative considered: keep an optional single-file flavor. Rejected because
it doubles build/package/test coverage without a stated product requirement,
and the measured transfer size favors the separate artifact. XW-005 is
satisfied by documenting the separate layout as the only supported default.

### D2 — Let Emscripten's static `new URL` provide the default resolution

The wrapper passes `locateFile` to the factory **only when the caller supplied
one**. With no options, Emscripten's generated
`new URL('xatlas.wasm', import.meta.url).href` stays visible to bundlers, so
Vite emits the binary as an asset and rewrites the URL. Injecting a wrapper
locator by default was rejected: it would hide the asset from bundlers and
force every consumer to copy the file manually.

Node uses the same expression, which resolves to a `file://` URL; Emscripten's
Node branch turns it into a filesystem path. Browser use fetches the URL and
uses streaming compilation when available, falling back to ArrayBuffer when
the MIME type or environment does not support streaming.

### D3 — Validate and forward `wasmBinary`, `locateFile`, `print`, `printErr`

`createXAtlas(options?)` validates before calling the factory:

- `wasmBinary` must be an `ArrayBuffer` or `ArrayBufferView`. Views are
  normalized to a `Uint8Array` over their exact byte range and copied, so the
  caller cannot mutate the supplied buffer while instantiation is in flight.
- `locateFile` must be a function. It is passed through unchanged so
  Emscripten can call it with `(path, prefix)`.
- `print` and `printErr` must be functions; they map to the Emscripten module
  logging hooks.

`wasmBinary` takes precedence: when present, the wrapper passes the bytes and
does **not** forward `locateFile`, because Emscripten calls the locator while
preparing the wasm even when bytes are supplied. This makes "bytes win" true
observably and avoids surprising locator calls. No options means default
sibling resolution.

Invalid types reject with a `TypeError` naming the option before any
instantiation. Unknown keys are ignored for forward compatibility.

### D4 — Neutral esbuild bundle plus a Vite-safe Node-module import

Replace the CLI `--platform=node` bundle with a small `scripts/bundle.mjs`
using the esbuild JS API:

- `platform: 'neutral'`
- `format: 'esm'`, output `dist/index.mjs`
- `external: ['module', 'fs', 'path', 'url']`
- a plugin that rewrites Emscripten's generated `import("module")` to
  `import(/* @vite-ignore */ nodeModuleSpecifier)` with a module-scoped
  `const nodeModuleSpecifier = 'module'`. Without this, Vite's resolver still
  warns that `module` is externalized for browser compatibility and emits an
  extra chunk even though the branch is Node-only.

Alternative considered: keep platform `node` and accept the warning. Rejected
because XW-004's acceptance criterion explicitly requires the warning to be
gone and the consumer test runs Vite in CI. Alternative considered: emit
separate browser and Node bundles through export conditions; rejected as a
larger packaging change than a neutral single bundle.

The Vite consumer test fails if the wasm asset is not emitted or if the
externalization warning appears. The rewrite is pinned to Emscripten 3.1.64;
if the glue changes shape, the bundle script must fail loudly rather than
silently emitting a Node-only import.

### D5 — Worker support through `ENVIRONMENT=web,node,worker`

Add `worker` to the Emscripten environment list. No wrapper change is needed:
a browser module worker resolves `import.meta.url` to the package entry and
fetches the sibling wasm; a Node worker thread takes the Node branch and reads
it from disk. The kernel stays single-threaded (`XA_MULTITHREADED=0`); workers
run a whole module instance, not pthreads.

Add `test/worker.test.mjs` (parent) and a small worker entry that imports
`dist/index.mjs`, meshes a quad, generates, and posts dimensions/counts back.
`npm test` runs both the existing smoke test and the worker test. README/API
document the `new Worker(new URL(...), { type: 'module' })` recipe and the
Node `worker_threads` equivalent. Browser worker execution is covered by the
documented recipe and the Vite build; no headless-browser dependency is added
in this change.

### D6 — Clear failure when the artifact is missing

The wrapper catches factory rejection and throws an `Error` whose message names
`xatlas.wasm` and includes the resolved URL when known, preserving the original
error as `cause`. There is no fallback to embedded data. `test/test.mjs` gains a
preflight check for `dist/xatlas.wasm`, and a negative test loads a copy of
`dist/index.mjs` without its sibling and asserts the rejection names the
artifact. `scripts/test-package.mjs` uses its existing `TEST_PACKAGE_DROP` hook
to prove a tarball without `dist/xatlas.wasm` fails the consumer test.

### D7 — Package and CI surface

- `package.json`: `files` becomes `dist/index.mjs`, `dist/xatlas.wasm`,
  `lib/xatlas.d.ts`, `README.md`, `LICENSE`; `bundle` delegates to
  `scripts/bundle.mjs`; `test` runs both smoke tests.
- `lib/xatlas.d.ts`: fill `CreateXAtlasOptions` and change the default export
  to `createXAtlas(options?: CreateXAtlasOptions)`.
- `scripts/test-package.mjs`: require `package/dist/xatlas.wasm`, exercise the
  Node consumer with default resolution, exercise the TypeScript consumer with
  loader options, and assert the Vite build emits and references a `.wasm`
  asset with no externalization warning.
- `.github/workflows/build-wasm.yml` and `publish.yml`: add
  `dist/xatlas.wasm` to the artifact verification, digest/size lists,
  provenance and uploaded artifact.
- `README.md`, `API.md`, `BUILD.md`: document the separate artifact, options,
  worker recipe and the removal of the single-file layout.
- `docs/improvements.md`: mark XW-001–XW-005 implemented and record the
  deferred license clause (XW-018).

## Risks / Trade-offs

- **Bundler asset discovery depends on the static `new URL` expression** →
  Keep the default path free of a wrapper-supplied `locateFile`; the Vite
  consumer test fails if the asset is not emitted.
- **The Emscripten glue rewrite is version-sensitive** → Emscripten is pinned
  to 3.1.64; the bundle script fails if the `import("module")` pattern is not
  found exactly once, and CI runs the Vite assertion.
- **Breaking artifact layout for existing consumers** → Document the migration
  (copy the wasm, use a bundler that understands `new URL`, or pass
  `locateFile`/`wasmBinary`) and treat the release as a minor bump (0.2.0);
  version/changelog enforcement remains XW-019.
- **Browser streaming depends on server MIME** → Emscripten falls back to
  ArrayBuffer instantiation, so a wrong MIME type degrades performance rather
  than breaking initialization.
- **Worker coverage is Node-only in CI** → The browser worker path is the same
  Emscripten worker branch exercised by the build; document the recipe and
  keep a manual example check. A headless-browser worker test is out of scope.
- **Package size grows by a separate binary** → Vite/Node caching can reuse the
  `.wasm` independently; the measured gzip transfer is smaller than the
  current single-file bundle.

## Migration Plan

1. Land the build and wrapper changes together; `npm run build` must produce
   `dist/xatlas.wasm` before any test or package step runs.
2. Update CI and the consumer test in the same change so the first green run
   proves the packed tarball contains and resolves the artifact.
3. Consumers using the default npm import need no code change if their
   bundler handles `new URL(..., import.meta.url)`; otherwise they copy
   `dist/xatlas.wasm` beside `dist/index.mjs` or pass `locateFile`/`wasmBinary`.
4. Rollback is a revert of this change; the previously published 0.1.3
   single-file package remains available for consumers that cannot ship an
   asset.
