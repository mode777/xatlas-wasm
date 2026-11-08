# Proposal

## Why

`xatlas-wasm` is currently tested for the first time during a release. The only
workflow is `publish.yml`; it installs Emscripten `latest` instead of the
documented 3.1.64 baseline, and no workflow exercises the packed npm tarball,
its declarations or a bundler. At the same time the local workflow is brittle:
`npm run clean` exits 127 because `rimraf` is not installed, `npm run build`
fails on a fresh clone unless `npm run configure` ran first, and `npm test`
reports a bare module-not-found error when `dist/index.mjs` is missing.

Implementing XW-015, XW-016, XW-017 and XW-020 now puts the safety net in place
before the larger loader, API and package changes in the backlog. It also makes
the toolchain and artifact digest visible, which is a precondition for
detecting size or toolchain drift after later refactors.

## What Changes

- **XW-015 — pinned toolchain and provenance.** Pin Emscripten to `3.1.64` in
  all workflows with `mymindstorm/setup-emsdk@v14`, verify the installed `emcc`
  version matches, log the SHA-256 and byte size of every emitted WASM/bundle
  artifact, and record the Emscripten version, Node version, source commit and
  `thirdparty/xatlas` submodule commit as release provenance.
- **XW-016 — push/pull-request CI.** Add `.github/workflows/build-wasm.yml`,
  triggered by pushes and pull requests, that checks out submodules, installs
  pinned Emscripten, runs `npm ci`, configure, build, the smoke test and the
  package consumer test, then uploads `dist/` together with a digest file. A
  failing job is intended to be the required status check that blocks a PR.
- **XW-017 — build ergonomics.** Replace the missing-`rimraf` clean script
  with `rm -rf build dist`, make `npm run build` configure automatically when
  no configured `build/` directory exists, and add a friendly preflight to
  `npm test` when `dist/index.mjs` is missing.
- **XW-020 — packed-package consumer test.** Add `npm run test:package`
  (`scripts/test-package.mjs`), modelled on
  `libfive-wasm/scripts/test-package.mjs`: `npm pack`, install the tarball into
  a scratch project, run a Node consumer, typecheck a TypeScript consumer and
  run a Vite production build.
- Update `BUILD.md`, `README.md` where they describe CI/scripts, and mark the
  implemented items in `docs/improvements.md`.

The change is **CI/release and build-tooling behaviour only**. It does not
change the public API, `lib/xatlas.d.ts` or `API.md`; it does not change the
package layout or shipped files; and it preserves the current
`SINGLE_FILE=1` loader contract and the single-threaded kernel. There is no
separate `.wasm` asset in this change, so the consumer test's Vite step only
verifies that the browser bundle builds — it does not expect an emitted
`.wasm` asset.

## Capabilities

### New Capabilities

None. All behaviour changes amend the existing `build-ci` capability.

### Modified Capabilities

- `build-ci`: replaces the unpinned-toolchain and no-push/PR-CI contracts,
  adds the packed-package consumer test and artifact-digest/provenance
  reporting, and updates the build-script and smoke-test contracts (clean
  succeeds, build auto-configures, test prints a preflight).

`packaging` is intentionally not modified: the tarball's contents, entry point,
declarations and runtime-dependency contract are unchanged. The consumer test
asserts that the existing package remains usable; fixing missing files is
XW-018, and the tag-gated release flow is XW-019.

## Impact

- Workflows: `.github/workflows/publish.yml` plus new
  `.github/workflows/build-wasm.yml`.
- Build scripts and tests: `package.json`, `package-lock.json`, new
  `scripts/test-package.mjs`, new configured-directory check used by the
  `prebuild` lifecycle, and `test/test.mjs` preflight.
- Dev dependencies: `typescript` and `vite` are added for the consumer test
  (still no runtime dependencies).
- Documentation: `BUILD.md`, `README.md`, `docs/improvements.md`.
- No changes to `src/`, `lib/`, `CMakeLists.txt`, `thirdparty/` or the compile
  and link options.

Out of scope and deliberately deferred:

- XW-001/XW-002: separate `xatlas.wasm`, loader options and bundler-neutral
  output. Until that lands, no test may require a packaged `.wasm` asset.
- XW-018: license text, `files`/`exports`/`engines` hygiene.
- XW-019: tag/version validation, trusted publishing, changelog and
  post-publish verification.
- XW-022: changing or locking the upstream submodule; this change only records
  the commit that is checked out.
- Repository-host branch-protection settings (the workflow can be marked
  required, but the setting lives outside the repository) and a headless
  browser test of `example/`.
