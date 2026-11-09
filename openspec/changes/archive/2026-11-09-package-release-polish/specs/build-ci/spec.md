# Spec Delta

## MODIFIED Requirements

### Requirement: Publish workflow

`.github/workflows/publish.yml` SHALL run on a published GitHub release and on
manual `workflow_dispatch`, resolve one release tag from the release or the
required `tag` input, check out that tag with submodules, run the pinned build
and test suite, verify the dist artifacts, attach provenance to the release,
and publish with `npm publish --provenance --access public` using
`id-token: write`.

#### Scenario: Published release produces an npm release

- **WHEN** a GitHub release is published
- **THEN** the workflow builds the WASM module, runs the smoke, loader, worker and package-consumer tests, and publishes the package to npm with provenance

#### Scenario: Release records toolchain and artifact provenance

- **WHEN** a release is published
- **THEN** the release records the release tag, Emscripten and Node.js versions, source commit, `thirdparty/xatlas` submodule commit, and the SHA-256 digest and size of the emitted artifacts

#### Scenario: Toolchain mismatch fails before publish

- **WHEN** the installed `emcc` does not report version `3.1.64`
- **THEN** the workflow fails before `npm publish` runs

#### Scenario: Provenance upload failure prevents publish

- **WHEN** `gh release upload` cannot attach `dist/PROVENANCE.txt` to the release
- **THEN** the workflow fails before `npm publish` runs

### Requirement: Artifact digest and size reporting

Every build workflow SHALL compute the SHA-256 digest and byte size of each
emitted `dist/` artifact (`dist/index.mjs`, `dist/xatlas.wasm`, and
`dist/xatlas.mjs` when present), print them to the job log and step summary,
and upload the digest file with the artifact. The publish workflow SHALL record
the release tag, Emscripten version, Node.js version, source commit and
`thirdparty/xatlas` submodule commit alongside the digests as release
provenance.

#### Scenario: Build reports digest and size

- **WHEN** a build workflow finishes compiling and bundling
- **THEN** the log and step summary show the SHA-256 digest and byte size of each emitted artifact, and the digest file is uploaded with the artifact

#### Scenario: Missing artifact fails digest reporting

- **WHEN** an expected `dist/` artifact is absent when digest reporting runs
- **THEN** the step fails instead of reporting an empty or partial digest

#### Scenario: Release provenance records the tag

- **WHEN** the publish workflow generates `dist/PROVENANCE.txt`
- **THEN** the file names the resolved release tag alongside the toolchain, source and submodule commits and the artifact digests

### Requirement: Packed-package consumer test

`npm run test:package` SHALL execute `scripts/test-package.mjs`, which SHALL
pack and install the tarball into a scratch project without registry access,
run the Node, TypeScript and Vite consumers, require the complete package file
set including `LICENSE`, `NOTICE` and `CHANGELOG.md`, and assert the package
manifest metadata.

#### Scenario: Consumer test passes on a packed package

- **WHEN** `npm run test:package` runs on a built checkout
- **THEN** the tarball installs in the scratch project with `dist/xatlas.wasm`, `LICENSE`, `NOTICE` and `CHANGELOG.md`, the Node consumer resolves the WASM beside the entry, the TypeScript typecheck passes with loader options, the Vite production build emits and references the WASM asset, and the manifest metadata assertions pass

#### Scenario: External tarball can be verified

- **WHEN** `test-package.mjs` is given an existing tarball through `TEST_PACKAGE_TARBALL`
- **THEN** it skips the local `npm pack` step and runs the same install, consumer, typecheck and Vite checks against that tarball

### Requirement: Packed-package consumer WASM failure handling

The consumer test SHALL fail when the tarball lacks a required entry,
declaration, license, notice, changelog or manifest field (including
`dist/xatlas.wasm`), when the Node consumer fails, when typechecking fails, or
when the Vite build fails, naming the failing stage and preserving the scratch
directory for inspection.

#### Scenario: Missing declaration fails the consumer test

- **WHEN** the packed tarball does not contain `lib/xatlas.d.ts`
- **THEN** `npm run test:package` exits non-zero and names the missing file

#### Scenario: Missing WASM asset fails the consumer test

- **WHEN** the packed tarball does not contain `dist/xatlas.wasm`
- **THEN** `npm run test:package` exits non-zero and names the missing artifact

#### Scenario: Missing license files fail the consumer test

- **WHEN** the packed tarball does not contain `LICENSE`, `NOTICE` or `CHANGELOG.md`
- **THEN** `npm run test:package` exits non-zero and names the missing file

#### Scenario: Manifest metadata mismatch fails the consumer test

- **WHEN** `sideEffects`, the `types` condition order, `publishConfig.access`, the `files` list or `engines.node` is wrong
- **THEN** `npm run test:package` exits non-zero and names the failing manifest field

#### Scenario: Broken consumer or bundle fails the consumer test

- **WHEN** the installed package cannot generate an atlas from the Node consumer or the Vite build fails
- **THEN** `npm run test:package` exits non-zero and preserves the scratch directory for inspection

## ADDED Requirements

### Requirement: Release tag and changelog validation

The publish workflow SHALL fail before building when the resolved tag is not an
annotated `v<package.json version>`, when `package-lock.json` version does not
match `package.json`, when no published non-draft GitHub release exists for the
tag, or when `CHANGELOG.md` has no section for the version.

#### Scenario: Matching annotated tag proceeds

- **WHEN** the release tag is `v0.2.0`, `package.json` and `package-lock.json` are `0.2.0`, the tag is annotated, the release is published and `CHANGELOG.md` has a `0.2.0` section
- **THEN** the workflow continues to the build and test steps

#### Scenario: Tag mismatch fails before publish

- **WHEN** the release tag is `v0.2.0` and `package.json` is `0.1.3`
- **THEN** the workflow fails before building and before `npm publish`

#### Scenario: Lightweight tag fails

- **WHEN** the release tag exists but is not an annotated Git tag
- **THEN** the workflow fails before building and before `npm publish`

#### Scenario: Lockfile mismatch fails

- **WHEN** `package.json` and `package-lock.json` declare different versions
- **THEN** the workflow fails before building and before `npm publish`

#### Scenario: Missing or draft release fails

- **WHEN** the tag has no GitHub release or its release is still a draft
- **THEN** the workflow fails before building and before `npm publish`

#### Scenario: Missing changelog section fails

- **WHEN** `CHANGELOG.md` has no section for the tag's version
- **THEN** the workflow fails before building and before `npm publish`

### Requirement: Manual release dispatch

`workflow_dispatch` SHALL require a `tag` input naming an existing published
release tag and SHALL use that tag for checkout, provenance upload and
verification. It SHALL NOT fall back to the branch name or `GITHUB_REF_NAME`.

#### Scenario: Manual retry publishes an existing release

- **WHEN** a maintainer runs `workflow_dispatch` with the tag of a published release
- **THEN** the workflow checks out that tag, uploads provenance to that release and runs the publish or idempotent verification path

#### Scenario: Branch name is rejected

- **WHEN** a maintainer runs `workflow_dispatch` with `main` or another branch name instead of a release tag
- **THEN** the workflow fails before building with a clear tag-validation error

### Requirement: Idempotent npm publish

When the exact package version already exists on the public npm registry, the
publish workflow SHALL skip `npm publish`, preserve the existing version, and
continue to post-publish verification. When the version does not exist, the
workflow SHALL publish exactly once.

#### Scenario: First run publishes the version

- **WHEN** the version is absent from the registry and all release checks pass
- **THEN** the workflow publishes the package once with provenance

#### Scenario: Retry verifies without republishing

- **WHEN** the version already exists on the registry and all release checks pass
- **THEN** the workflow skips `npm publish` and proceeds to post-publish verification

### Requirement: Post-publish verification

After the publish or idempotent skip, the workflow SHALL verify the exact
version from the public npm registry within a bounded retry window, download
the registry tarball, confirm the required package files, install it in a clean
scratch project, and generate an atlas. It SHALL fail the job when any check
fails.

#### Scenario: Published version is verified

- **WHEN** the version appears on the registry and the clean-install consumer generates an atlas
- **THEN** the workflow succeeds and reports the verified version

#### Scenario: Version never appears

- **WHEN** the registry does not expose the version within the retry window
- **THEN** the workflow fails with a timeout error naming the version

#### Scenario: Registry tarball is incomplete

- **WHEN** the downloaded registry tarball lacks a required package file
- **THEN** the workflow fails and names the missing file

#### Scenario: Clean install cannot generate an atlas

- **WHEN** the registry tarball installs but the consumer cannot generate an atlas
- **THEN** the workflow fails and reports the consumer error
