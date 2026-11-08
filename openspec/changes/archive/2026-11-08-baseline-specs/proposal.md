# Proposal

## Why

The repository adopts OpenSpec but has no capability specs, so the first
behaviour-changing proposal has no explicit "before" contract to preserve or
amend. `docs/improvements.md` XW-024 requires capturing the current observable
behaviour of `xatlas-wasm@0.1.3` first, so later changes can be expressed as
deltas (ADDED/MODIFIED/REMOVED requirements) against a reviewed baseline
instead of comparing against memory or README prose.

## What Changes

- Add four new capability specs that record what the shipped package does
  today, under `openspec/changes/baseline-specs/specs/`:
  - `wasm-loader`: WASM artifact and module initialization — the
    `SINGLE_FILE=1` embedded-binary contract, the no-argument
    `createXAtlas()` factory, ESM loading in Node >= 16 and modern browsers,
    and the absence of a worker environment.
  - `atlas-api`: the `XAtlas` instance contract — mesh input methods, chart
    and pack options, result getters, `AddMeshError` codes and strings,
    progress-callback cancellation, and `getMesh()` copy semantics.
  - `packaging`: the npm package contract — ESM-only entry points, type
    declarations, `files` allow-list and actual tarball contents, `engines`,
    and zero runtime dependencies.
  - `build-ci`: how the artifact is produced and released — CMake/Emscripten
    flags, the pinned `thirdparty/xatlas` submodule, npm build scripts
    (including the currently broken `clean`), the single Node smoke test, and
    the publish workflow.
- Record current limitation-behaviours as first-class requirements rather than
  footnotes: `createXAtlas()` accepts no options and ignores arguments; no
  image accessor is exposed even when `PackOptions.createImage` is set;
  non-`Uint32Array` index buffers are copied as raw bytes but declared
  `Uint16` (silent corruption); result handles are not bounds-checked; there is
  no use-after-destroy guard; `destroy()` is manual; `npm run clean` fails
  because `rimraf` is not installed; and the tarball ships no `LICENSE` despite
  listing it in `files`.
- No production code changes. No change to the public API, the package layout
  or the build.
- **Loader/artifact contract:** unchanged. This change remains fully
  compatible with the current `SINGLE_FILE=1` embedding and does not alter,
  deprecate or implement it; XW-001/XW-002 will amend these specs later.

## Capabilities

### New Capabilities

- `wasm-loader`: how the WASM binary is delivered and how the module is
  initialized in Node and browsers, including the current absence of loader
  options and worker support.
- `atlas-api`: the runtime contract of the `XAtlas` instance returned by
  `createAtlas()`, including inputs, outputs, error codes, callback semantics
  and the observed behaviour on misuse.
- `packaging`: the published npm package: entry points, type declarations,
  shipped files, runtime dependencies and supported Node version.
- `build-ci`: the build, test and release pipeline that produces the package.

### Modified Capabilities

None. No existing capability specs exist yet, and no requirement of the
current runtime is being changed.

## Impact

- Files: only `openspec/changes/baseline-specs/` (proposal, four capability
  specs, design, tasks). No changes to `lib/`, `src/`, `CMakeLists.txt`,
  `package.json`, `test/`, `.github/workflows/`, `README.md`, `API.md`,
  `BUILD.md` or `docs/improvements.md`.
- Behaviour: none. The specs are descriptive; they document the 0.1.3
  behaviour including its limitations.
- Downstream: after archive, these specs become `openspec/specs/` and are the
  baseline that `build-ci-hardening`, `wasm-loader-options`,
  `mesh-input-validation`, `object-lifecycle`, `atlas-result-api`,
  `abi-hardening`, `package-release-polish` and `docs-provenance` modify or
  remove. No dependency, artifact or runtime change ships with this change.

## Out of Scope

- Implementing any `XW-###` improvement item (XW-001–XW-023); this change only
  records the behaviour they will change.
- Fixing the documented limitations (loader options, image accessor, input
  validation, lifetime guards, `clean` script, missing license).
- Syncing the specs into `openspec/specs/` — that happens when the change is
  archived, not during apply.
- Any edit to production code, documentation, build files or CI workflows.
