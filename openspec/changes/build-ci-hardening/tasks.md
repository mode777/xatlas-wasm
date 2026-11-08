# Tasks

## 1. Dependencies and build-script ergonomics

- [ ] 1.1 Add pinned `typescript` and `vite` devDependencies compatible with Node >= 18 and update `package-lock.json`; verify `npm ci` exits 0 and `node node_modules/typescript/bin/tsc --version` and `node node_modules/vite/bin/vite.js --version` print the installed versions
- [ ] 1.2 Replace the `clean` script with `rm -rf build dist`; verify `npm run clean` exits 0 after `npm ci`, removes both directories, and `git status --short` shows no tracked deletions
- [ ] 1.3 Add `scripts/ensure-configured.mjs`, which checks for `build/CMakeCache.txt` and spawns `npm run configure`, and wire it as the `prebuild` script; verify `rm -rf build dist && npm run build` prints the configure step and exits 0
- [ ] 1.4 Add the `dist/index.mjs` existence check and dynamic import to `test/test.mjs`; verify `rm -rf dist && npm test` exits non-zero with the message naming `npm run build`, then `npm run build && npm test` prints `All checks passed.`
- [ ] 1.5 Update `BUILD.md` prerequisites, configure/build/test/clean and npm-script sections with the 3.1.64 pin, auto-configure, preflight and Unix-shell clean; verify every documented command runs as written
- [ ] 1.6 Update the `README.md` Development section with the build, smoke-test and `test:package` commands and the 3.1.64 target; verify the snippets match `package.json` scripts

`API.md` and `lib/xatlas.d.ts` need no change: this change does not alter the public API, loader contract, package layout or runtime behaviour. The consumer test verifies the existing declarations only.

## 2. Packed-package consumer test

- [ ] 2.1 Create `scripts/test-package.mjs` with the pack → scratch install → Node consumer → `tsc --noEmit` → Vite build flow from `design.md`, including required-tarball-file checks and scratch cleanup on success; verify `node scripts/test-package.mjs` exits 0 on a built checkout
- [ ] 2.2 Add the `test:package` script to `package.json`; verify `npm run test:package` exits 0 and prints the packed tarball name
- [ ] 2.3 Add the `TEST_PACKAGE_DROP` negative-test hook and verify `TEST_PACKAGE_DROP=lib/xatlas.d.ts npm run test:package` exits non-zero at the typecheck stage and `TEST_PACKAGE_DROP=dist/index.mjs npm run test:package` exits non-zero at the Node-consumer stage, preserving the scratch directory
- [ ] 2.4 Confirm the Vite assertion requires only a successful build and emitted JS assets, with no `dist/xatlas.wasm` expectation; verify by grep-ing the script for wasm checks and running `npm run test:package` against the `SINGLE_FILE=1` build
- [ ] 2.5 Document `npm run test:package`, the scratch/`KEEP_PACKAGE_TEST` behaviour and the deferred `.wasm`/`LICENSE` checks in `BUILD.md` and `README.md`; verify the documented commands run as written

## 3. Continuous integration workflows

- [ ] 3.1 Create `.github/workflows/build-wasm.yml` with `push` to `main` and `pull_request` triggers, `contents: read`, submodule checkout, Node 24, pinned `mymindstorm/setup-emsdk@v14` (`version: 3.1.64`), the `emcc --version` assertion, `npm ci`, configure, build, smoke test and `test:package`; verify the workflow YAML contains every required step and the first push runs the `build` job green
- [ ] 3.2 Add the SHA-256/byte-size step to both workflows, writing a digest/size file and the `$GITHUB_STEP_SUMMARY`, and fail on a missing expected artifact; verify the commands produce the expected rows against the local `dist/` artifacts
- [ ] 3.3 Add `actions/upload-artifact@v4` to `build-wasm.yml` to upload `dist/` with the digest/size files; verify a successful run exposes a downloadable artifact containing `dist/index.mjs`, `dist/xatlas.mjs` and the digest file
- [ ] 3.4 Update `.github/workflows/publish.yml` to pin Emscripten 3.1.64, assert the version, run `npm run test:package`, generate `dist/PROVENANCE.txt` (toolchain, Node, commit, submodule commit, digests/sizes), upload it with `gh release upload` before `npm publish`, and add `contents: write`; verify the diff contains all steps and no `version: latest`
- [ ] 3.5 Document the workflow triggers, pinned toolchain, artifact name and the externally configured required `build` check in `BUILD.md`; verify the documentation matches the workflow files

## 4. Documentation and backlog

- [ ] 4.1 Update `docs/improvements.md` to mark XW-015, XW-016 and XW-017 implemented and XW-020 **partially** implemented (the tarball-content, Node, TypeScript and Vite checks are delivered; its missing-`.wasm` acceptance check is deferred to XW-001 and its missing-license check to XW-018), with the change name and date, and record any remaining sub-items (XW-022 lock/provenance, XW-018 package contents, XW-019 release flow, XW-001 `.wasm`); verify the entries read as implemented
- [ ] 4.2 Update `BUILD.md` and `README.md` links/wording affected by the new CI and scripts so they no longer describe CI as unpinned or `clean` as broken; verify no stale `latest`/`rimraf` claims remain in either document

## 5. Integration verification

- [ ] 5.1 Run `npm ci && npm run clean && npm run build && npm test && npm run test:package` from a clean checkout and verify the whole chain exits 0
- [ ] 5.2 Run `git status --short` and `git diff --stat` and verify only the intended source/workflow/docs files changed, with no `build/` or `dist/` output tracked and no changes under `src/`, `lib/`, `API.md`, `CMakeLists.txt` or `thirdparty/` except the intended `SINGLE_FILE`-preserving state
- [ ] 5.3 Run `openspec validate --all --strict` and verify exit code 0 with all changes and baseline specs valid
- [ ] 5.4 Push the implementation to GitHub and verify the `build` workflow is green on `main`, its artifact is downloadable, and a deliberately failing PR is blocked once `build` is configured as a required status check

## Workflow follow-up

- Repository administrator: configure the `build` job as a required status check for `main`; this is a GitHub setting and is out of scope for the repository files.
- On the next published release, verify `PROVENANCE.txt` is attached and that `npm publish` ran only after the smoke and package-consumer tests.
- Archive the change after review and after the synced `build-ci` spec and `docs/improvements.md` agree.
