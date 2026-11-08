# Design

## Context

See `proposal.md` for motivation. The current state that shapes the approach:

- `.github/workflows/publish.yml:28-31` is the only workflow and passes
  `version: latest` to `mymindstorm/setup-emsdk@v14`; `BUILD.md:5-7` already
  says the project targets Emscripten 3.1.64, so documentation and CI
  disagree.
- `package.json:21-27` has `"clean": "rimraf build dist"` with no `rimraf`
  dependency (`npm run clean` exits 127), `"build": "cmake --build build &&
  npm run bundle"` with no configure step, and `"test": "node test/test.mjs"`.
  `test/test.mjs:8` statically imports `../dist/index.mjs`, so a missing build
  fails before any friendly check can run.
- The package is `SINGLE_FILE=1`: `dist/xatlas.mjs` embeds the WASM as base64
  and `dist/index.mjs` is the esbuild bundle. There is no `dist/xatlas.wasm`.
  `docs/improvements.md` §8 measures the current bundle at 102,715 bytes
  gzipped (`gzip -9 -c dist/index.mjs | wc -c`), and the separate-file
  experiment at 6,582 + 68,811 = 75,393 bytes — but that experiment is
  XW-001/002, not this change.
- `npm pack --dry-run` currently produces four files: `README.md`,
  `dist/index.mjs`, `lib/xatlas.d.ts`, `package.json`; there is no `LICENSE`
  or `.wasm` (XW-018 and XW-001).
- The consumer-test reference is
  `~/workspace/libfive-wasm/scripts/test-package.mjs`: it packs the real
  tarball, installs it into an `mkdtemp` scratch project, runs a Node consumer,
  typechecks with the repository's `typescript`, and builds with the
  repository's `vite`. It keeps the scratch tree on failure.

## Goals / Non-Goals

**Goals:**

- Make CI and local builds use the same toolchain and make drift visible.
- Gate every push to `main` and every PR on build, smoke test and tarball
  consumer test.
- Make clean/build/test work from a fresh clone without undocumented steps.
- Prove the published tarball is importable, typed and bundleable before it is
  published.

**Non-Goals:**

- No change to `SINGLE_FILE`, loader options, the public API, `API.md`,
  `lib/xatlas.d.ts`, the package `files` list or the kernel build flags
  (`XA_MULTITHREADED=0` stays).
- No Windows-native clean/build guarantee; see the clean-script decision.
- No lock file or change of the `thirdparty/xatlas` submodule (XW-022), no
  tag/version checks or trusted publishing (XW-019), no license/package fixes
  (XW-018), no separate `.wasm` assertion (XW-001), no repository branch
  protection configuration and no headless browser smoke test.

## Decisions

### Pin Emscripten in both workflows and verify it

Use `mymindstorm/setup-emsdk@v14` with `version: 3.1.64` in both
`.github/workflows/build-wasm.yml` and `.github/workflows/publish.yml`, followed
by an explicit assertion:

```sh
emcc --version | head -n 1 | grep -F '3.1.64'
```

The action pin selects the SDK; the assertion catches an action default,
cache or runner image that resolves to something else. The step fails before
`npm ci`/configure, so the rest of the job never runs on drift. `BUILD.md`
keeps the same 3.1.64 statement for local builds. Alternative: install emsdk
with raw `git clone`/`emsdk install 3.1.64`; rejected because the repository
already uses the action and it provides caching.

### Digest and size reporting

After build (and in publish before publishing), a dedicated step requires
`dist/xatlas.mjs` and `dist/index.mjs` to exist, then for each file:

```sh
sha256sum "$f" | tee -a dist/SHA256SUMS
stat -c '%n %s bytes' "$f" | tee -a dist/SIZES
```

The same rows are appended to `$GITHUB_STEP_SUMMARY` as a Markdown table, and
`dist/SHA256SUMS`/`dist/SIZES` are uploaded with `dist/` via
`actions/upload-artifact@v4`. The digest step fails if an expected artifact is
missing rather than emitting an empty file. Both workflows run on
`ubuntu-latest`, so GNU `sha256sum`/`stat -c` are available; no third-party
action is needed. The digest covers the single-file bundle, which is the
artifact users actually download; a separate-WASM digest arrives with XW-001.

### Build-and-test workflow

`.github/workflows/build-wasm.yml` with:

- `on: push: branches: [main]` and `pull_request`.
- `permissions: contents: read`.
- One job `build` on `ubuntu-latest`: checkout with `submodules: recursive`;
  `actions/setup-node@v4` with Node 24 and npm cache; pinned emsdk plus the
  version assertion; `npm ci`; `npm run configure`; `npm run build`;
  `npm test`; `npm run test:package`; digest/size step; upload `dist/`.
- The job name `build` becomes the required status check in repository branch
  protection. That setting is external to the repository and is deliberately
  out of scope, but without it the "blocks a PR" requirement is not enforced.
- Upload retention is short (14 days); artifacts are build evidence, not
  releases.

`npm run configure` is explicit in CI even though `build` auto-configures, so a
configure-only failure has its own log section. The local path still relies on
the auto-configure behaviour.

### Clean and build ergonomics (XW-017)

- **Clean:** `"clean": "rm -rf build dist"`. The project already requires a
  Unix-like Emscripten/CMake toolchain and CI is Ubuntu, so this removes the
  undeclared `rimraf` dependency without adding a dev dependency. Alternative:
  add `rimraf`; rejected to keep the dependency surface and install size
  unchanged. Consequence: native Windows shells need Git Bash/WSL; document it.
- **Auto-configure:** add `scripts/ensure-configured.mjs` and wire
  `"prebuild": "node scripts/ensure-configured.mjs"`. The npm lifecycle runs it
  automatically for `npm run build`; it checks for
  `build/CMakeCache.txt` (not merely the directory, so a stale empty `build/`
  still triggers configure), spawns `npm run configure` with inherited stdio,
  and exits with the child's status. Alternative: a shell condition inside the
  `build` script; rejected because quoting/`[ -f ]` is less portable and harder
  to test than a small Node script. `npm run configure` remains a public step.
  Implementation note: `ensure-configured.mjs` also creates `dist/` when it is
  absent — CMake creates the directory at configure time but `em++` fails on a
  later build if only `dist/` was deleted, so the mkdir keeps
  `rm -rf dist && npm run build` working against a warm `build/` tree.
- **Test preflight:** `test/test.mjs` checks
  `existsSync(new URL('../dist/index.mjs', import.meta.url))` before importing,
  prints `dist/index.mjs not found. Run "npm run build" first.` to stderr and
  exits 1; only then does it dynamically `import()` the bundle. A `pretest`
  lifecycle script was rejected because `node test/test.mjs` is the documented
  direct invocation and would still show the raw module error.

### Packed-package consumer test (XW-020)

Add `scripts/test-package.mjs`, adapted from
`libfive-wasm/scripts/test-package.mjs`, and `"test:package": "node
scripts/test-package.mjs"`. Mechanics:

1. Preflight `dist/index.mjs` and `lib/xatlas.d.ts`; fail with a build hint.
2. `npm pack --ignore-scripts --pack-destination <scratch>/pack`.
3. `tar tzf` the tarball and require `package/dist/index.mjs`,
   `package/lib/xatlas.d.ts`, `package/README.md` and `package/package.json`.
   Do **not** require `LICENSE` (XW-018) or `package/dist/xatlas.wasm` (XW-001).
4. Write a scratch `package.json` (`private`, `type: module`), then
   `npm install --ignore-scripts --no-audit --no-fund --no-package-lock
   <tarball>`. The package has no runtime dependencies, so this needs no
   registry metadata.
5. Node consumer `check.mjs`: import `createXAtlas` from `xatlas-wasm`, create
   a quad, `addMesh`, `generate`, assert non-zero `width`/`height`/
   `vertexCount`/`indexCount`, repeat with `generate({}, { createImage: true })`
   and assert `getImage()` returns data, then `destroy()`.
6. TypeScript consumer `check.ts` plus `tsconfig.json` with `strict`, `noEmit`,
   `module`/`moduleResolution: nodenext`, `skipLibCheck: false`; run the
   repository's `node_modules/typescript/bin/tsc -p ...` so declarations from
   the tarball are checked without installing extra tools in the scratch tree.
7. Vite consumer: `index.html` + `src/main.js` importing the package and
   generating a small atlas; run the repository's `node_modules/vite/bin/vite.js
   build --logLevel warn` in the scratch project. Assert `dist/index.html`
   references a generated JS asset and that the build exits 0. **Do not** look
   for a `.wasm` asset: under `SINGLE_FILE=1` there is none, and the Vite
   `Module "module" has been externalized` warning documented in
   `docs/improvements.md` §8 is acceptable (the build succeeds; XW-001/003 fix
   the root cause).
8. On failure, print the stage and keep the scratch directory; on success,
   remove it unless `KEEP_PACKAGE_TEST=1`. For the negative test path, support
   `TEST_PACKAGE_DROP=lib/xatlas.d.ts` (or `dist/index.mjs`), which deletes
   that file from the installed scratch copy before the consumers run. This
   proves the test fails on a broken package without modifying tracked files;
   the variable is a local verification hook only and is not set in CI.

`typescript` and `vite` become dev dependencies (and lockfile entries) because
the test runs them from the repository. They are not runtime dependencies and
do not change the published tarball. Alternative: run `npx tsc`/`npx vite`;
rejected because it can fetch unpinned versions and defeats reproducibility.

### Release provenance (XW-015)

`publish.yml` writes `dist/PROVENANCE.txt` containing the first line of
`emcc --version`, `node --version`, `$GITHUB_SHA`, the
`thirdparty/xatlas` commit (`git -C thirdparty/xatlas rev-parse HEAD`) and the
digest/size rows, prints it to the step summary, and attaches it to the
triggering release with `gh release upload "$GITHUB_REF_NAME"
dist/PROVENANCE.txt --clobber`. That adds `contents: write` to the workflow
permissions (alongside the existing `id-token: write` for npm provenance) and
runs before `npm publish`, so a provenance failure prevents the publish.
Appending the text to the release body with `gh release edit` was rejected as
more fragile and better handled by the release-flow change (XW-019). A
committed submodule lock/README is deferred to XW-022; this change records the
checked-out commit only.

### Deferred work

- XW-001–XW-005: separate `.wasm`, loader options, worker/bundler support.
  No test may require an emitted `.wasm` in this change.
- XW-018: license and package-manifest contents; the consumer test does not
  assert `LICENSE` yet.
- XW-019: tag/version enforcement, trusted publishing, changelog and
  post-publish verification.
- XW-022: upstream/submodule provenance lock and documentation.
- Branch protection configuration and a headless browser smoke test of
  `example/`.

## Risks / Trade-offs

- [The setup action or runner image resolves a different emsdk] → the explicit
  `emcc --version` assertion fails the job before configure/build.
- [Digest step depends on GNU coreutils] → both workflows are pinned to
  `ubuntu-latest`; the commands are checked in the step itself.
- [`rm -rf` is not native Windows] → the build already assumes an
  Emscripten/Unix toolchain; document Git Bash/WSL. Revisit if Windows becomes a
  supported build host.
- [Adding `typescript`/`vite` grows `npm ci` and CI time] → they are
  dev-only, pinned by the lockfile, and the consumer test is the release gate
  XW-020 requires; Vite also catches browser-bundle breakage the smoke test
  cannot.
- [Consumer test installs can be slow or touch the registry] → install only the
  local tarball, use `--ignore-scripts --no-audit --no-fund
  --no-package-lock`, and rely on the zero-runtime-dependency contract.
- [Vite warning about externalized `module` looks like a failure] → the script
  asserts only exit status and emitted assets; the warning is known and
  documented, and is fixed by the loader change.
- [Provenance upload needs `contents: write`] → add it explicitly; run the
  upload before `npm publish` so the release cannot be partially unprovenanced.
- [Required-check enforcement lives outside the repo] → name the job `build`,
  document the setting in `BUILD.md`; a missing setting is a process risk, not
  a workflow-code defect.

## Migration Plan

Merge to `main`; the first push runs `build-wasm.yml`. Configure the `build`
job as a required status check for `main` (repository settings, out of scope).
Subsequent releases use the updated `publish.yml`; the next release should show
the pinned toolchain and `PROVENANCE.txt`. Rollback is a revert of the
workflow/script commit: no package, API or data migration is involved. Keep the
old `publish.yml` behavior only as a fallback if the release job fails before
publishing; there is no partial publish state because provenance and tests run
first.
