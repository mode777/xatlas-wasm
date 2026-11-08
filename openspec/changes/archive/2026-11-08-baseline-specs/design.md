# Design

## Context

See `proposal.md` — Why. This change turns the observed behaviour of
`xatlas-wasm@0.1.3` (`main` at `4bb211e`) into four baseline capability specs.
The audit and its measurements live in `docs/improvements.md`
(XW-001..XW-024); XW-024 is the process item implemented here. Nothing in the
runtime changes, so the design work is about which sources are authoritative
for each claim and how the delta is shaped for later changes.

Current state, verified in the repository:

- **Loader** — `CMakeLists.txt:126` sets `SINGLE_FILE=1`; `:125` sets
  `ENVIRONMENT=web,node`; `:117–124` set `MODULARIZE`, `EXPORT_ES6`,
  `EXPORT_NAME=createXAtlasModule`, `ALLOW_MEMORY_GROWTH`,
  `ALLOW_TABLE_GROWTH` and `NO_EXIT_RUNTIME`. The wrapper imports the
  generated glue at `lib/xatlas.mjs:493`, and the default export is
  `export default async function createXAtlas()` with no parameters at
  `lib/xatlas.mjs:499`. `package.json:24` bundles `lib/xatlas.mjs` into
  `dist/index.mjs` with esbuild `--platform=node`.
- **API** — the `XAtlas` class is `lib/xatlas.mjs:57–477`: `destroy()` at
  `:66–75`, `addMesh()` at `:88–190`, `addUvMesh()` at `:200–249`,
  `addMeshJoin()` at `:251–253`, `computeCharts()` at `:259–271`,
  `packCharts()` at `:277–289`, `generate()` at `:296–318`,
  `setProgressCallback()` at `:324–339`, getters at `:343–352`, and
  `getMesh()` at `:359–406`. Index-format detection is the
  `indices instanceof Uint32Array` check at `:138` and `:219`.
  `lib/xatlas.d.ts:251–313` declares the instance interface,
  `:316` is an empty `CreateXAtlasOptions`, and `:348` declares
  `createXAtlas()` with zero parameters.
- **Packaging** — `package.json:5` is `"type": "module"`, `:6–14` declare
  `main`/`module`/`types`/`exports`, and `:15–19` are the `files` allow-list
  including `LICENSE`; there is no root `LICENSE` file, and `npm pack`
  produces four files (`docs/improvements.md` §8).
- **Build/CI** — `CMakeLists.txt:15–16` define `XATLAS_C_API=1` and
  `XA_MULTITHREADED=0`; `package.json:22–27` are the npm scripts and
  `:52–54` the `engines` range. `test/test.mjs` is the only test. The only
  workflow is `.github/workflows/publish.yml`, triggered by
  `release: published` and `workflow_dispatch` (`:4–6`), installing Emscripten
  `latest` (`:31`), running the build/test steps (`:40–55`) and publishing
  with `--provenance` (`:58`).

Audit evidence used for context (not requirements): wasm 173,401 B, base64
payload 231,204 chars, `dist/xatlas.mjs` 255,928 B, `dist/index.mjs`
276,507 B (gzip 102,715 B), `npm pack` tarball 106,834 B
(`docs/improvements.md` §2.1). The separate-file experiment measured 75,393 B
gzipped in total (§8) — useful only as the expected benefit for XW-001.

Proposal-time verification: the progress-cancellation asymmetry (cancelling
during `ComputeCharts` leaves `width`/`height`/`atlasCount` at `0`, while
cancelling during `BuildOutputMeshes` leaves the packed dimensions set) and the
use-after-destroy and `Int32Array` reproductions were re-run against the audit
build (`dist/index.mjs`, Emscripten 3.1.64) on 2026-11-08; the `atlas-api`
scenarios match the observed output.

## Goals / Non-Goals

**Goals:**

- Record the shipped 0.1.3 behaviour as four capability specs whose
  requirements are observable and testable, including limitation-behaviours.
- Give later changes stable requirement headers they can MODIFY or REMOVE
  instead of re-deriving the "before" state.
- Keep rationale, measured sizes and file:line evidence out of the specs and
  in this design.

**Non-Goals:**

- No production code, build, package-manifest, workflow or user-docs change.
- No implementation of XW-001..XW-023; the specs only describe what those
  items will change.
- No sync into `openspec/specs/` during apply — that is the archive step.
- No assertion of unverified implementation details (for example exact C
  error-string literals) that are not observable through the public API.

## Decisions

### Four capabilities rather than one

`wasm-loader`, `atlas-api`, `packaging` and `build-ci` mirror the four bullets
of XW-024 and the change streams in `docs/improvements.md` §6: `wasm-loader`
is amended by `wasm-loader-options` (XW-001–XW-005); `atlas-api` by
`mesh-input-validation`, `object-lifecycle` and `atlas-result-api`
(XW-006–XW-011, XW-014); `packaging` by `package-release-polish`
(XW-018–XW-019); `build-ci` by `build-ci-hardening` (XW-015–XW-017, XW-020).
Alternatives considered: a single `xatlas-wasm` capability (rejected — every
future delta collides in one file and capability ownership is unclear) and a
capability per method or per XW item (rejected — too granular to archive
cleanly).

### Limitations are requirements, not footnotes

Where current behaviour is the misuse path, the requirement states the
current `SHALL` and the scenario asserts the observed outcome (silent
corruption, zeroed results after `destroy()`, no image accessor). This is what
lets a later change express `## REMOVED Requirements` or `## MODIFIED
Requirements`; a prose note cannot be removed or tested. The alternative —
keeping limitations only in `docs/improvements.md` — was rejected because
archive cannot diff against prose and XW-024 explicitly asks for the current
contract, including its limitations.

### Specs describe behaviour, not internals

Specs avoid C symbol names, struct offsets and file paths; those remain in the
design and implementation. A refactor that preserves behaviour (for example
`abi-hardening`, XW-012) must not invalidate a spec. The alternative,
transcribing the implementation, was rejected because it would make every
internal change a spec change.

### Source hierarchy for each claim

Three source classes back the requirements, in this order:

1. **Executable evidence** — `test/test.mjs` (quad generation, progress
   callback, non-zero assertions, `destroy()`), plus the reproduction snippets
   in `docs/improvements.md` §8 for typed-array corruption, use after destroy
   and the missing image accessor.
2. **Static contract** — `CMakeLists.txt`, `package.json`,
   `.github/workflows/publish.yml`, `lib/xatlas.d.ts`, and the code paths
   listed under Context.
3. **User documentation** — `README.md:10–14`, `README.md:56–60`,
   `API.md:126–140`, `API.md:448`, `API.md:527–539`,
   `BUILD.md:56–87`.

Exact error-string text is intentionally not quoted: the `thirdparty/xatlas`
submodule is not checked out in this workspace (`git submodule status` shows
`-f700c7790aaa030e794b52ba7791a05c085faf0c`), so the C string table could not
be read. `API.md:527–539` documents the code semantics and the specs require a
"human-readable message" rather than an exact literal.

### Loader paths recorded by the baseline

- **Node** — `import` resolves `dist/index.mjs` (`package.json:6–14`), which
  contains the wrapper and the Emscripten glue; `createXAtlas()` calls the
  factory with no arguments (`lib/xatlas.mjs:499–500`). With `SINGLE_FILE=1`
  the glue decodes the embedded base64 payload and calls
  `WebAssembly.instantiate` on an `ArrayBuffer`; no `.wasm` file is read
  (`docs/improvements.md` §2.2).
- **Browser** — the same bundle initializes with no `.wasm` request and no
  server MIME configuration (`README.md:64–67`); `instantiateStreaming` is
  unavailable for a data URI, which the spec records as absence of a streaming
  path.
- **Worker** — `ENVIRONMENT=web,node` (`CMakeLists.txt:125`) excludes
  `worker`, so the baseline has no worker target; XW-003 will add it and must
  modify `wasm-loader`.
- **Bundled/installed layouts** — the installed package is the single
  `dist/index.mjs` (276,507 B; 102,715 B gzipped). A Vite 7 consumer build
  succeeds but externalizes `module` and emits an extra ~276 KB chunk
  (`docs/improvements.md` §2.4); this is bundler friction for XW-004, not a
  broken path, and is not encoded as a requirement.
- **Failure mode when the wasm artifact is missing** — unreachable for
  consumers because the binary is embedded. The corresponding build-time
  failures are: an uninitialized submodule leaves
  `thirdparty/xatlas/source/xatlas/xatlas.cpp` absent at
  `CMakeLists.txt:7,11`; a missing `dist/xatlas.mjs` breaks the static import
  at `lib/xatlas.mjs:493` during bundling; a missing `dist/index.mjs` breaks
  `test/test.mjs:8` with a module-not-found error. The specs capture the
  consumer-visible facts and the missing-build-output test failure; the build
  failures belong to `build-ci`.

### Returned typed-array ownership and use-after-destroy

`getMesh()` copies `indices` with `HEAPU32.buffer.slice(...)`
(`lib/xatlas.mjs:383–386`) and each chart's `faces` the same way
(`:399–401`); vertex objects are freshly allocated (`:369–380`). The returned
arrays are therefore caller-owned copies with no dependence on the atlas, and
they remain valid after `destroy()` and after heap growth. This is recorded as
a spec requirement so `atlas-result-api` (XW-011) can add views without
silently changing ownership.

`destroy()` unregisters the progress callback and calls `_xatlasDestroy`,
then leaves `this._ptr = 0` (`lib/xatlas.mjs:66–75`). There is no
`requireAlive` guard, so getters read address 0 and return `0`, and
`getMesh()` returns zero counts with empty arrays (`docs/improvements.md`
§8). The baseline spec records that outcome; `object-lifecycle` (XW-007) must
replace it with a throwing contract.

### Packaging records the actual tarball

`files` lists `dist/index.mjs`, `lib/xatlas.d.ts`, `README.md` and `LICENSE`
(`package.json:15–19`), but no root `LICENSE` exists, so `npm pack` ships four
files including `package.json` and no license text (`docs/improvements.md`
§8). The spec states both the declared allow-list and the observed omission;
recording only the intended list would make the baseline false. The missing
license and README links are XW-018 work.

### Build defects are part of the baseline

`npm run clean` is `rimraf build dist` (`package.json:25`) while `rimraf` is
not installed (`:29–31` only lists esbuild), so it exits `127`
(`docs/improvements.md` §8). CI installs `emsdk: latest`
(`.github/workflows/publish.yml:31`) although `BUILD.md:5–7` targets 3.1.64,
and only the publish workflow exists, so pushes and PRs run no checks. These
are recorded as requirements with their observed outcomes, to be removed by
`build-ci-hardening` (XW-015–XW-017, XW-020).

### Validation strategy

Author in dependency order (proposal → specs → design → tasks) and run
`openspec validate --change baseline-specs --strict` after each phase. The
change is documentation-only, so the acceptance test is the strict validator
plus a requirement-by-requirement cross-check against the sources above;
there is no new runtime test to add. `tasks.md` carries the checklist for that
cross-check, the XW-024 progress note and the final
`openspec validate --all --strict`.

## Risks / Trade-offs

- **Baseline freezes incidental defects as contract** → Each limitation
  requirement names the XW item that will remove or modify it, and wording is
  current-tense; archive reconciliation in `docs/improvements.md` keeps the
  intent visible.
- **Specs drift from `API.md` and `lib/xatlas.d.ts`** → Specs restate only
  observable behaviour; the project rule that all three move together still
  applies to later changes. This change touches none of them because the
  runtime is unchanged.
- **Unverified exact strings or generated-artifact internals** → Specs avoid
  exact C literals and avoid asserting glue internals; the design records the
  gap.
- **Baseline goes stale as the sequence lands** → Expected. The deltas are the
  mechanism; `docs/improvements.md` §6 fixes the order, with
  `build-ci-hardening` first and `wasm-loader-options` next.
- **Four capabilities create four main specs at archive** → Accepted; each
  maps to a distinct future change stream and stays small enough to review.
- **Scope creep into fixing docs or scripts** → The change directory is the
  only writable scope; README/API/BUILD already describe 0.1.3 (XW-023
  progress note), so no doc edit is needed for a behaviour-preserving
  baseline.

## Migration Plan

No runtime migration: no artifact, API or package changes ship, and rollback
is deleting `openspec/changes/baseline-specs/`. On archive,
`openspec archive baseline-specs` copies the four ADDED capabilities into
`openspec/specs/<capability>/spec.md`; the follow-up order is
`build-ci-hardening` → `wasm-loader-options` → `mesh-input-validation` /
`object-lifecycle` → `atlas-result-api` → `abi-hardening` →
`package-release-polish` → `docs-provenance` (`docs/improvements.md` §6).
During apply, annotate XW-024 in `docs/improvements.md` with the change name
and mark it implemented at archive.

## Open Questions

- Whether the image accessor is delivered inside `atlas-result-api` or as its
  own change is deferred to that proposal; the baseline only fixes the current
  absence.
- Whether the future separate-artifact build keeps a single-file flavour is
  XW-005 work; the baseline records the current single-file mode without
  deciding the target layout.
