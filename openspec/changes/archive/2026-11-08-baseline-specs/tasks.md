# Tasks

## 1. Review the baseline capability specs

- [x] 1.1 Confirm `proposal.md` cites XW-024, states that no production code changes, and records that the `SINGLE_FILE`/loader contract is unchanged; verify with `grep -n "XW-024\|SINGLE_FILE" openspec/changes/baseline-specs/proposal.md` and that the Out of Scope section lists XW-001..XW-023.
- [x] 1.2 Author the `specs/wasm-loader/spec.md` baseline delta and verify it against `CMakeLists.txt:117–126`, `lib/xatlas.mjs:493–499`, `lib/xatlas.d.ts:316–348`, `README.md:10–14` and `README.md:64–67`; verify every scenario is supported by one of those sources and that no unsupported loader option is documented.
- [x] 1.3 Author the `specs/atlas-api/spec.md` baseline delta and verify it against `lib/xatlas.mjs:57–477`, `lib/xatlas.d.ts:251–313`, `test/test.mjs:8–94` and the reproduction snippets in `docs/improvements.md` §8; confirm each limitation scenario (typed-array corruption, use after destroy, missing image accessor, unchecked handles) matches the recorded observation.
- [x] 1.4 Author the `specs/packaging/spec.md` baseline delta and verify it against `package.json:5–19` and the `npm pack --dry-run` evidence in `docs/improvements.md` §8; confirm the spec records the actual four-file tarball and the missing `LICENSE`, not the intended file list.
- [x] 1.5 Author the `specs/build-ci/spec.md` baseline delta and verify it against `CMakeLists.txt:7–16`, `package.json:22–54`, `test/test.mjs`, `BUILD.md:56–87` and `.github/workflows/publish.yml:4–58`; confirm the script chain, the `rimraf` failure, the unpinned `emsdk: latest`, the absence of push/PR CI and the publish triggers are all recorded as observed.
- [x] 1.6 Confirm `design.md` cites concrete files and lines for every spec group and carries the measured sizes from `docs/improvements.md` §2.1/§8 only in the design, never in a spec; verify with `grep -n "276,507\|102,715\|173,401" openspec/changes/baseline-specs/specs` returning no matches.

## 2. Verify requirements and scenarios mechanically

- [x] 2.1 Confirm every requirement block has at least one `#### Scenario:` with a `- **WHEN**` and a `- **THEN**` line; verify with `grep -c "^### Requirement:"` versus `grep -c "^#### Scenario:"` per spec file and a manual scan for WHEN/THEN pairs.
- [x] 2.2 Confirm no requirement description exceeds 500 characters and no spec contains rationale, file paths or measured sizes; verify by running `openspec validate baseline-specs --strict` and reviewing any warning.
- [x] 2.3 Confirm the unverified exact error-string text is not quoted (the `thirdparty/xatlas` submodule is uninitialized); verify `git submodule status` shows the `-` prefix and that `specs/atlas-api/spec.md` only requires a non-empty human-readable message.
- [x] 2.4 Confirm the four capability paths in the proposal match the spec directories exactly (`wasm-loader`, `atlas-api`, `packaging`, `build-ci`); verify with `find openspec/changes/baseline-specs/specs -name spec.md | sort` and compare to the proposal Capabilities section.

## 3. Documentation and backlog bookkeeping

- [x] 3.1 Confirm `README.md`, `API.md` and `BUILD.md` need no change for this change because no behaviour changes: verify this change introduces no edits to them (the doc-sync modifications already in the working tree predate `baseline-specs`), and record the confirmation in the apply notes.
- [x] 3.2 Add a `Progress` note to XW-024 in `docs/improvements.md` stating that the four baseline capability specs were authored under `baseline-specs` and are awaiting review; verify with `grep -n "XW-024" -A 6 docs/improvements.md`.
- [x] 3.3 Confirm no production code, build script, manifest or workflow was modified by this change: verify `git status --short` shows no new paths beyond `openspec/changes/baseline-specs/` and the `docs/improvements.md` progress note (the untracked OpenSpec scaffolding and the README/API/BUILD doc-sync edits already in the tree predate this change).
- [x] 3.4 Confirm no generated build output is tracked: verify `git status --short` does not list `build/` or `dist/` and `git check-ignore build dist` prints both paths.

## 4. Validation gate

- [x] 4.1 Run `openspec validate baseline-specs --strict` and confirm it reports the change as valid with exit code 0.
- [x] 4.2 Run `openspec validate --all --strict` and confirm it exits 0 with all four capabilities validating.
- [x] 4.3 Run `openspec status --change baseline-specs` and confirm `proposal`, `specs`, `design` and `tasks` are all `done`.

## Workflow follow-up

- Archive `baseline-specs` after review; archive syncs the four ADDED capabilities into `openspec/specs/<capability>/spec.md` and updates the XW-024 entry to implemented.
- Start `build-ci-hardening` (XW-015–XW-017, XW-020) next, per `docs/improvements.md` §6.
