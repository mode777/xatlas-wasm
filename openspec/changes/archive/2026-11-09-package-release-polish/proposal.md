# Proposal

## Why

The next `xatlas-wasm` release should not repeat the current release gaps. The
last npm publish (`0.1.3`, 2026-05-22) predates the publish workflow's
provenance-upload step, the repository has no release tags or GitHub releases,
and a `workflow_dispatch` run on `main` would try to upload provenance to a
nonexistent release named `main`. The package also lists `LICENSE` in `files`
but ships no license text, no upstream xatlas notice and no changelog.

This change implements XW-018 and XW-019, and closes the missing-license check
deferred from XW-020. It prepares the package and release path before the next
version bump; it does not publish a release itself.

## What Changes

- **Package contents and license (XW-018).** Add a root MIT `LICENSE` and a
  `NOTICE` containing the upstream xatlas MIT license and copyright. Include
  both in the npm tarball, add `CHANGELOG.md`, and require all three in the
  packed-package consumer test. Make README documentation and license links
  absolute so they work on npm without shipping `API.md` or `BUILD.md`.
- **Manifest hygiene (XW-018).** Set `sideEffects` to `false`, put the `types`
  condition before `import` in `exports["."]`, and add
  `publishConfig.access: "public"`. Keep `engines.node` at `>=16.0.0`; the
  Node >= 18 development baseline remains documented, and narrowing the
  runtime range is deferred to a separate compatibility change.
- **Release tag and changelog validation (XW-019).** Resolve one release tag
  from the published GitHub release or a required `workflow_dispatch` input,
  check out that tag, and fail before building or publishing when the tag is
  not an annotated `v<package.json version>`, when `package-lock.json` disagrees,
  when no published non-draft release exists, or when `CHANGELOG.md` has no
  section for the version.
- **Publish flow (XW-019).** Use the resolved tag for provenance upload,
  include the release tag in `PROVENANCE.txt`, and keep OIDC trusted publishing
  with `id-token: write`. Add an idempotent publish check so a retry of an
  already-published version skips `npm publish` and proceeds to verification.
- **Post-publish verification (XW-019).** Add a verification script that waits
  for the version to appear on the public registry, downloads the registry
  tarball, and runs the existing Node/TypeScript/Vite consumer test against it.
- **Tests and documentation.** Add focused tests for release-tag validation and
  the package manifest, extend `test:package`, and update `BUILD.md`,
  `README.md` and `docs/improvements.md` with the new release procedure and
  evidence.

**Compatibility:** the loader/artifact contract, public API, runtime
dependencies and Node.js `>=16` engine range are unchanged. The package gains
license, notice and changelog files and stricter release validation.

**Out of scope:** the version bump and actual npm release, `engines.node >=18`,
refreshing action major versions, repository settings such as tag protection or
required checks, XW-022 docs provenance, correcting the stale baseline note in
`openspec/config.yaml`, and archiving other active changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `packaging`: tarball contents, license and upstream notice, changelog,
  manifest metadata and README documentation links.
- `build-ci`: release-tag and changelog validation, manual dispatch semantics,
  provenance, idempotent publishing and post-publish verification.

## Impact

- `package.json`, `README.md`, `BUILD.md`, `docs/improvements.md`
- New `LICENSE`, `NOTICE` and `CHANGELOG.md`
- `.github/workflows/publish.yml`
- `scripts/test-package.mjs`, new release verification scripts, new tests and
  the `npm test`/`test:package` commands
- `openspec/specs/packaging/spec.md` and `openspec/specs/build-ci/spec.md` via
  this change's delta specs
- No runtime API, loader, dependency or build-toolchain change
