# Design

## Context

See `proposal.md` for motivation. The current publish workflow
(`.github/workflows/publish.yml`) already pins Node 24 and Emscripten 3.1.64,
runs the smoke/loader/worker tests and the packed-package consumer test,
writes artifact digests and provenance, uploads `PROVENANCE.txt` to the
release, and publishes with OIDC trusted publishing. The gaps are in package
contents and release preconditions:

- `package.json` lists `LICENSE` but no root `LICENSE` exists; the published
  `0.1.3` tarball has four files and 301,776 bytes unpacked. The current local
  build is `dist/index.mjs` 49,938 B, `dist/xatlas.mjs` 25,190 B and
  `dist/xatlas.wasm` 173,401 B; only the entry and wasm are published.
- The README still links to `API.md` relatively, and `API.md`/`BUILD.md` are
  not in the tarball. There is no `CHANGELOG.md`, no `publishConfig`, no
  `sideEffects` declaration, and the `types` export condition is second.
- The workflow's last successful run (`0.1.3`, 2026-05-22) predates the
  provenance-upload step. There are no tags or GitHub releases. A
  `workflow_dispatch` on `main` sets `GITHUB_REF_NAME=main`, so the upload step
  would target a nonexistent release named `main`.
- `scripts/test-package.mjs` requires the package entry, wasm and declarations
  but does not require license, notice or changelog files; XW-020 explicitly
  deferred the missing-license check to XW-018.
- The `Build WASM` push/PR workflow already runs `npm test` and
  `npm run test:package`, so extending those checks gives the implementation a
  gate on every push and pull request.

The loader contract, public API, dependency set and Emscripten build are not
changing. The package remains ESM-only, runtime-dependency-free and declared
for Node `>=16`.

## Goals / Non-Goals

**Goals:**

- Ship a complete npm tarball: license, upstream notice, changelog, existing
  wasm entry and declarations.
- Make the manifest suitable for tree-shaking and TypeScript resolution without
  changing runtime behavior.
- Make the release workflow reject a mismatched tag, a lightweight tag, a
  missing/draft release, a lockfile mismatch or a missing changelog entry
  before it builds or publishes.
- Make manual dispatch operate on an existing release tag instead of the
  branch name.
- Verify the exact published artifact from the public registry with a clean
  install consumer.
- Keep the package small and the release path auditable.

**Non-Goals:**

- Bumping the package version or publishing a release in this change.
- Changing the `>=16.0.0` engine range; the Node >= 18 development baseline is
  documented separately.
- Refreshing action major versions or the Emscripten setup action. The current
  actions are green in `Build WASM`; a separate CI maintenance change can
  refresh them.
- Repository settings such as tag protection, required checks or a protected
  deployment environment. `BUILD.md` can document them as follow-ups.
- XW-022 upstream/submodule provenance, the stale baseline note in
  `openspec/config.yaml`, or archiving other changes.

## Decisions

### 1. Use a root `LICENSE` plus a separate `NOTICE`

Add `LICENSE` with the package's MIT license and `NOTICE` with the upstream
xatlas MIT license and copyright (`thirdparty/xatlas/LICENSE`, copyright
2018-2020 Jonathan Young). Add both to `package.json#files` and require both in
the packed-package test.

**Why:** the two licenses cover different copyright holders and should remain
verbatim and independently readable. A separate `NOTICE` is the conventional
place for third-party attribution, and `npm pack` can include it directly.
**Alternatives:** one combined `LICENSE` file is smaller but mixes upstream
text into the package license; shipping `thirdparty/xatlas/LICENSE` preserves
the upstream path but makes the notice hard to find in the installed package.

### 2. Ship `CHANGELOG.md` and use it as the release-note source

Add a Keep a Changelog style file with an `Unreleased` section and sections for
the published `0.1.0` through `0.1.3` versions. Include it in the tarball.
The release workflow checks that a section exists for `package.json`'s version;
the release checklist tells maintainers to write the section before creating
the tag and use it as the GitHub release notes.

**Why:** XW-019 asks for a changelog, and a versioned section gives the release
workflow an objective precondition. Shipping it lets consumers read the change
history from the package. **Alternatives:** keep the changelog out of the
tarball, or generate notes from git log. Git-log notes do not capture
user-visible framing and do not give the workflow a stable check.

### 3. Make README documentation links absolute

Change the relative `API.md` link and add absolute links for `LICENSE`,
`NOTICE` and `CHANGELOG.md`. Keep `API.md` and `BUILD.md` out of the tarball.

**Why:** absolute GitHub links work on npm and in the repository, and the
tarball stays focused on runtime artifacts plus legal/release metadata. **Alternative:**
include `API.md` and `BUILD.md` in `files`; this makes the tarball larger and
duplicates development documentation. The XW-018 acceptance allows either
choice as long as no README link is broken.

### 4. Add manifest metadata but keep the Node engine range

- `sideEffects: false`: the entry exports a factory; wasm loading happens when
  `createXAtlas()` is called, not at module evaluation.
- Put `types` before `import` in `exports["."]`: TypeScript resolves the
  condition in declaration order and recommends `types` first.
- `publishConfig.access: "public"`: prevents an accidental restricted publish;
  the workflow keeps `--access public` for explicitness.
- Keep `engines.node: ">=16.0.0"`: narrowing to >=18 is a compatibility change
  with its own testing and changelog entry. The development toolchain already
  documents Node >=18 and CI uses Node 24.
- Keep `--provenance` in the workflow. npm now generates provenance
  automatically for OIDC publishes, but the explicit flag keeps the intent
  visible and is harmless.

**Alternative:** set `publishConfig.provenance: true` and remove the CLI flag.
That would make local `npm publish` require provenance and is a larger change;
the workflow-level flag is sufficient.

### 5. Resolve and validate one release tag

Add a required `tag` string input to `workflow_dispatch` and use one expression
for the tag:

```text
github.event.release.tag_name || inputs.tag
```

Use that value for `actions/checkout.ref`, the validation steps, the provenance
upload and the post-publish verifier. Check out with `fetch-depth: 0` so the
annotated tag object is available. Never use `GITHUB_REF_NAME` for the upload.

Validation is split:

- `scripts/verify-release-tag.mjs` performs the file-based checks: exact
  `v<package.json version>` match, `package-lock.json` version match, and a
  `CHANGELOG.md` section for the version. It accepts a `--root` fixture so the
  checks can be tested without changing the repository.
- Workflow shell steps check that the resolved tag is annotated
  (`git cat-file -t "$RELEASE_TAG"` is `tag`) and that a published, non-draft
  GitHub release exists (`gh release view`). These require git/GitHub state and
  stay in the workflow.

**Why:** the file checks are deterministic and unit-testable; the git/release
checks need the actual event and token. The split also gives clear failure
messages. **Alternatives:** one bash step is simpler but hard to test and easy
to get wrong; keeping `GITHUB_REF_NAME` preserves the current branch-upload
bug; removing `workflow_dispatch` loses the retry path and conflicts with the
existing build-ci spec.

### 6. Treat manual dispatch as a retry of an existing release

The workflow does not create tags or releases. A maintainer creates an
annotated tag with `git tag -a`, pushes it, and creates the GitHub release with
`gh release create --verify-tag`. Manual dispatch exists to retry a failed
publish or verification for an existing release. If the input is `main` or
another branch name, the tag validation fails before the build.

**Why:** release creation is an intentional, reviewed action; the workflow's
job is to build and publish what was released. **Alternative:** let
`workflow_dispatch` create the release from a branch; that mixes release
authoring with publishing and makes the tag/version guarantee weaker.

### 7. Make publish idempotent and verify the registry artifact

Before publishing, read the version and check `npm view`:

- If the exact version exists, skip `npm publish` and continue.
- Otherwise run `npm publish --provenance --access public`.

After either path, run `scripts/verify-published.mjs`:

1. Poll `npm view xatlas-wasm@<version> version` with a bounded retry window.
2. Download the registry tarball with `npm pack`.
3. Run the existing `test-package.mjs` against that tarball through a new
   `TEST_PACKAGE_TARBALL` input, which skips the local `npm pack` step and
   performs the same Node, TypeScript and Vite consumer checks.

The verifier also accepts a local `--tarball <path>` override so the
clean-install path can be tested without registry access.

**Why:** the post-publish check validates the actual registry artifact, not
the local build. Reusing `test-package.mjs` avoids a second consumer harness.
The idempotent skip makes a manual retry possible after a post-publish
verification failure without a version conflict. **Trade-off:** an existing
version could theoretically come from a different commit; the tag/version,
lockfile, changelog and release checks make that a process error rather than a
normal path. Versions remain immutable and are not overwritten. **Alternative:**
a simple `npm view` check is faster but does not prove the package installs;
a bespoke smoke script duplicates the existing consumer harness.

### 8. Test at three layers

- `test/manifest.test.mjs` reads `package.json`, `README.md` and
  `CHANGELOG.md` and asserts the file list, metadata, engine range, current
  changelog section and absence of relative links to repository-only docs.
  Add it to `npm test`.
- `test/release-tag.test.mjs` runs `verify-release-tag.mjs` against the real
  checkout and temporary fixtures for tag, lockfile and changelog mismatches.
  Add it to `npm test`.
- `scripts/test-package.mjs` gains the license/notice/changelog requirements,
  installed-content checks and an external-tarball mode. The existing
  `Build WASM` workflow runs it on every push and PR, so a broken tarball fails
  before a release.

The release workflow itself is the integration test for the git/release checks
and the registry verification; the first release after this change should be
watched end to end and recorded in `docs/improvements.md`.

## Risks / Trade-offs

- **Manual dispatch becomes stricter** → Users must pass an existing release
  tag. `BUILD.md` will show the retry command and the error message will name
  the expected `v<version>`. The old branch dispatch behavior is intentionally
  removed because it could upload to a nonexistent release.
- **Annotated tag enforcement can reject a release created from the UI** →
  `BUILD.md` will use `git tag -a` plus `gh release create --verify-tag`; the
  failure message will tell maintainers to recreate the tag as annotated.
- **Registry propagation delays** → The verifier polls with a bounded retry
  window and fails with a timeout naming the version. A manual retry uses the
  idempotent path, so a slow registry does not require a new version.
- **Post-publish failure after a successful publish** → The version is already
  public; the job fails with the consumer error and the manual retry skips
  publishing and re-runs verification. The release notes and provenance remain
  attached for audit.
- **`sideEffects: false` could hide an import-time side effect** → The entry is
  a factory and the wasm load is lazy; the existing loader/worker tests and the
  packed consumer test cover import and initialization. If a future change adds
  import-time behavior, it must revisit this flag.
- **Action majors are older than current releases** → They are green in the
  current `Build WASM` runs; refreshing them is a separate CI maintenance
  change. Pinning to the same majors avoids mixing action upgrades with release
  semantics.
- **No protected environment or tag rules yet** → The workflow validates tags
  and releases itself, but repository settings are still needed for defense in
  depth. `BUILD.md` will list tag protection and a protected environment as
  recommended follow-ups.
- **Absolute README links require network access** → This is normal for
  repository documentation. The package still ships `LICENSE`, `NOTICE` and
  `CHANGELOG.md`, so the legal and release information is available offline.

## Migration Plan

1. Land the package, manifest, script and test changes; `Build WASM` runs the
   extended `npm test` and `npm run test:package` on the push.
2. Before the next release, bump `package.json` and `package-lock.json`, add the
   version section to `CHANGELOG.md`, and commit/push. Wait for `Build WASM` to
   pass.
3. Create an annotated tag `v<version>` and push it; create the GitHub release
   with `gh release create --verify-tag` and notes from the changelog.
4. The release workflow validates the tag, lockfile, changelog and release,
   builds and tests, uploads provenance, publishes or idempotently skips, and
   verifies the registry tarball.
5. If a pre-publish step fails, fix the cause and re-run the release workflow.
   If post-publish verification fails, re-run `workflow_dispatch` with the same
   tag; the already-published version is verified rather than republished.
6. Record the first successful run and any repository-settings follow-ups in
   `docs/improvements.md`.

Rollback: npm versions are immutable. A bad release is deprecated and followed
by a patch version; the workflow never unpublishes or overwrites a version.
The annotated tag and release assets remain as the audit trail.
