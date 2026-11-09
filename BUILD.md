# Building xatlas-wasm

## Prerequisites

- [Emscripten SDK (emsdk)](https://emscripten.org/docs/getting_started/downloads.html)
  — the project targets and CI pins **Emscripten 3.1.64** (matching the
  `libfive-wasm` baseline). Both workflows install 3.1.64 and assert
  `emcc --version` before building, so use the same version locally.
- [CMake](https://cmake.org/) >= 3.13
- [Node.js](https://nodejs.org/) >= 18 for the development tooling (the
  published package supports >= 16); CI uses Node 24
- Git with submodule support

## Setup

1. **Install and activate emsdk 3.1.64.** The repository does not vendor
   emsdk; point the command at your checkout. If it sits next to this repo:

   ```powershell
   # PowerShell
   ..\emsdk\emsdk_env.ps1
   ```

   ```bash
   # Bash / Linux / macOS
   source ../emsdk/emsdk_env.sh
   ```

   In this workspace/container the SDK is installed at
   `~/workspace/emsdk`, so use `source ~/workspace/emsdk/emsdk_env.sh`.

2. **Initialize the submodule** (if not already done):

   ```sh
   git submodule update --init --recursive
   ```

3. **Install the JavaScript tooling**:

   ```sh
   npm ci
   ```

## Configure

```sh
npm run configure
```

This runs `emcmake cmake -B build -DCMAKE_BUILD_TYPE=Release`. You only need
to run it explicitly for an isolated configure; `npm run build` does it
automatically when `build/CMakeCache.txt` is absent (see below).

## Build

```sh
npm run build
```

The `prebuild` lifecycle hook runs `scripts/ensure-configured.mjs`, which
recreates `dist/` if needed and runs `npm run configure` when
`build/CMakeCache.txt` is missing. A clean checkout, or one where you ran
`rm -rf build dist`, therefore builds with the single command above — no
manual configure step. The build then runs CMake and bundles the JavaScript
entry with esbuild. It produces:

| Output | Contents |
|---|---|
| `dist/xatlas.mjs` | Emscripten ES module glue; it resolves the sibling `xatlas.wasm` at runtime. |
| `dist/xatlas.wasm` | The standalone WebAssembly binary loaded by the glue. |
| `dist/index.mjs` | The bundled npm entry point (wrapper + glue); the WASM is not embedded. |

The package ships `dist/index.mjs` and `dist/xatlas.wasm` side by side. Keep
them together when copying or serving the package; alternatively supply
`wasmBinary` or `locateFile` to `createXAtlas()`. See
[`docs/improvements.md`](docs/improvements.md) for the XW-001 design rationale.

Running `cmake --build build` alone produces `dist/xatlas.mjs` and
`dist/xatlas.wasm`; use `npm run build` when you need the publishable
`dist/index.mjs`.

## Test

```sh
npm test
# or
node test/test.mjs
```

`npm test` runs the Node smoke test, the loader-options test and the worker
test. The tests import `dist/index.mjs`, so build first. If `dist/index.mjs` or
`dist/xatlas.wasm` is missing, the smoke test prints a preflight message naming
`npm run build` and exits 1 instead of failing with a bare module error. The
smoke test adds a four-vertex quad, generates an atlas and checks the output
dimensions, mesh counts and the `getImage()` behaviour; success ends with
`All checks passed.`

### Packed-package consumer test

```sh
npm run test:package
```

`scripts/test-package.mjs` packs the real npm tarball, installs it into a
scratch project under the OS temp directory (not in the repository), and then:

- checks the tarball contains `dist/index.mjs`, `dist/xatlas.wasm`,
  `lib/xatlas.d.ts`, `README.md`, `LICENSE`, `NOTICE`, `CHANGELOG.md` and
  `package.json`;
- runs a Node consumer that imports the installed package, resolves the
  sibling WASM, generates an atlas with `createImage: true` and checks
  `getImage()`;
- typechecks a TypeScript consumer against the packaged declarations with the
  repository's `typescript`, including the loader options;
- runs a Vite production build of a consumer app, asserts it emitted and
  referenced both a JS asset and the `.wasm` asset, and fails if Vite reports a
  Node built-in externalization warning.

The scratch tree is removed on success and kept on failure for inspection;
`KEEP_PACKAGE_TEST=1 npm run test:package` keeps it after a successful run.
`TEST_PACKAGE_DROP=<file>` deletes a file from the installed scratch copy before
the consumers run; it is a maintainer hook for proving a broken package fails,
not part of CI. Dropping `dist/xatlas.wasm` must fail the installed-contents
check.

`npm run bundle` uses `scripts/bundle.mjs` with esbuild `--platform=neutral`.
Emscripten's Node-only `import("module")` is rewritten to a non-literal
specifier so Vite does not externalize it for browser consumers. The published
package includes the root `LICENSE`, the upstream xatlas `NOTICE` and
`CHANGELOG.md`. See [`docs/improvements.md`](docs/improvements.md) for the
release history.

## Clean

```sh
npm run clean
```

This runs `rm -rf build dist` and exits 0 without an extra dependency. It
requires a Unix-like shell (Linux, macOS, or Git Bash/WSL on Windows); native
PowerShell/cmd has no `rm -rf`.

## npm scripts

| Command            | Description |
| ------------------ | ----------- |
| `npm run configure`| Run the emcmake CMake configure step |
| `npm run prebuild` | Internal `build` hook: configure when `build/CMakeCache.txt` is missing and ensure `dist/` exists |
| `npm run build`    | Auto-configure if needed, build WASM, then bundle into `dist/index.mjs` |
| `npm run bundle`   | Bundle `lib/xatlas.mjs` + Emscripten glue with the neutral esbuild config |
| `npm test`         | Run the manifest, release-tag, smoke, loader-options and worker tests |
| `npm run test:package` | Pack the tarball and run the Node/TypeScript/Vite consumer test, including license, notice, changelog and manifest checks |
| `npm run clean`    | Remove `build/` and `dist/` with `rm -rf` (Unix-like shell) |
| `npm run example`  | Serve the browser example on port 3000 |

## Continuous integration

Three GitHub Actions workflows cover the build, publish and showcase deployment:

| Workflow | Trigger | Behaviour |
|---|---|---|
| `Build WASM` (`.github/workflows/build-wasm.yml`) | pushes to `main` and all pull requests | Checks out submodules, uses Node 24, installs Emscripten 3.1.64 (asserting `emcc --version`), runs `npm ci`, configure, build, `npm test` and `npm run test:package`, then writes `dist/SHA256SUMS`/`dist/SIZES` and the job summary and uploads `dist/` as the `xatlas-wasm-dist` artifact (14-day retention). A dependent `site` job downloads that same artifact, typechecks, tests and builds the showcase with `SITE_BASE=/xatlas-wasm/`, and verifies the emitted wasm asset. |
| `Build & Publish to npm` (`.github/workflows/publish.yml`) | published releases and `workflow_dispatch` with a release `tag` input | Validates the annotated tag, package/lockfile versions, changelog section and non-draft GitHub release before building. Runs the same pinned build and both test suites, computes the digests/sizes, generates `dist/PROVENANCE.txt` (release tag, Emscripten and Node versions, source commit, `thirdparty/xatlas` commit, digests/sizes), attaches it to the release with `gh release upload`, publishes with `npm publish --provenance --access public` (or skips an already-published version), then verifies the registry tarball. |
| `pages` (`.github/workflows/pages.yml`) | completion of a successful `Build WASM` push to `main` | Checks out the tested revision, downloads its `xatlas-wasm-dist` artifact, builds the showcase with `SITE_BASE=/xatlas-wasm/`, verifies the wasm asset, and deploys `site/dist` to GitHub Pages. Requires Pages to be enabled with the GitHub Actions source. |

Both build workflows use `mymindstorm/setup-emsdk@v14` with `version: 3.1.64`
and fail before configure if `emcc` reports anything else. The publish job
validates the tag, lockfile, changelog and published release before building,
then attaches provenance before publishing, so an upload failure prevents the
release.

The `build` job in `Build WASM` is intended to be a **required status check**
for `main`, so a failing run blocks a pull request from merging. That is a
repository-settings action, not a file in this repository:
GitHub → **Settings → Branches → Branch protection rules** for `main` → add
`build` under required status checks. Without that setting the workflow still
runs, but merge blocking is not enforced.

## Releasing

The npm package is published only from the `Build & Publish to npm` workflow.
The workflow is tag-gated: it validates the release tag, package and lockfile
versions, changelog section, annotated tag and published GitHub release before
it builds or publishes.

1. **Bump the version and changelog.** Keep `package.json` and
   `package-lock.json` in sync and add a changelog section for the release:

   ```sh
   version=0.2.0   # replace with the release version
   npm version "$version" --no-git-tag-version
   ```

   Add `## [$version] - YYYY-MM-DD` to `CHANGELOG.md` and move the relevant
   `Unreleased` entries under it. The workflow fails if the section is missing.

2. **Commit and push `main`.** Wait for the `Build WASM` push run to pass:

   ```sh
   git add package.json package-lock.json CHANGELOG.md
   git commit -m "release $version"
   git push origin main
   gh run list --workflow "Build WASM" --branch main --limit 1
   ```

3. **Create and push an annotated tag.** The tag must be
   `v<package.json version>` and must be annotated:

   ```sh
   git tag -a "v$version" -m "xatlas-wasm $version"
   git push origin "v$version"
   ```

4. **Create the GitHub release.** Use `--verify-tag` so the release points at
   the annotated tag you just pushed. Put the changelog section in the release
   notes (`--notes-file` or the GitHub UI):

   ```sh
   gh release create "v$version" --verify-tag \
     --title "v$version" --notes-file release-notes.md
   ```

   Publishing the release triggers `Build & Publish to npm`. Watch the run:

   ```sh
   gh run list --workflow "Build & Publish to npm" --limit 1
   gh run watch <run-id>
   ```

5. **Verify the published package.** The workflow verifies the registry
   tarball after publishing. You can repeat the check locally:

   ```sh
   npm view "xatlas-wasm@$version" version
   node scripts/verify-published.mjs "v$version"
   ```

6. **Retry safely.** If a pre-publish step fails, fix the cause and re-run the
   workflow. If post-publish verification fails, re-run `workflow_dispatch`
   with the release tag; the workflow skips the already-published version and
   re-runs verification:

   ```sh
   gh workflow run publish.yml --ref main -f tag="v$version"
   ```

   The `workflow_dispatch` input must be an existing published release tag; a
   branch name such as `main` is rejected before the build. The workflow uses
   trusted publishing/OIDC and does not read a stored `NPM_TOKEN`.

### Trusted publishing and repository settings

- **npm trusted publisher.** Configure the package on npmjs.com with the
  GitHub repository `mode777/xatlas-wasm` and workflow filename `publish.yml`.
  The workflow requests `id-token: write` and runs
  `npm publish --provenance --access public`; no `NPM_TOKEN` secret is needed.
  The filename is part of the npm trust configuration, so do not rename it
  without updating the npm package settings.
- **Workflow permissions.** The publish workflow requests `contents: write`
  to attach `dist/PROVENANCE.txt` to the GitHub release and `id-token: write`
  for OIDC. It does not request any other write permission.
- **Tag protection.** Protect the `v*` tag pattern so only maintainers can
  create or delete release tags. The workflow additionally requires the tag to
  be annotated and to match `package.json`.
- **Required build check.** Keep the `build` job in `Build WASM` as a required
  status check for `main` (see [Continuous integration](#continuous-integration)).
- **Protected environment (optional).** A protected `npm-publish` environment
  can add reviewer approval. If you add it, select the same environment in the
  npm trusted publisher configuration and add `environment: npm-publish` to the
  publish job; that workflow change is a separate follow-up.
- **Registry verification.** After publishing, the workflow runs
  `node scripts/verify-published.mjs "$RELEASE_TAG"`, which polls the public
  registry, downloads the registry tarball and runs the packed-package
  consumer against it. The same command works locally for an existing release.

## Browser example

After building, run:

```sh
npm run example
```

Then open <http://localhost:3000/example/>. The example loads
`thirdparty/xatlas/models/gazebo.obj` by default and renders the input
wireframe next to the generated UV atlas.

## Showcase site

The public gallery under [`site/`](site/) is a separate Vite + TypeScript
consumer. It links the local package (`file:..`), is not part of the npm
tarball, and requires Node.js >= 20 for its toolchain. Build the root package
first, then:

```sh
cd site
npm ci
npm run dev        # http://localhost:5173/
```

Validation and production build:

```sh
npm run check
npm test
SITE_BASE=/xatlas-wasm/ npm run build
SITE_BASE=/xatlas-wasm/ npm run build:check
```

`build:check` fails if the output does not contain a referenced `.wasm` asset.
The `site` job in `Build WASM` runs the same typecheck, tests and build on every
push and pull request. `.github/workflows/pages.yml` deploys the tested artifact
to <https://mode777.github.io/xatlas-wasm/> after a successful `main` run; the
repository must have Pages enabled with the **GitHub Actions** source. See
[`site/README.md`](site/README.md) for the scenario contract and deployment
details.

## OpenSpec workflow

This repository is spec-driven. Functional changes are proposed, specified,
implemented and archived as OpenSpec changes under `openspec/changes/`; see
[`AGENTS.md`](AGENTS.md) for the full workflow and
[`docs/improvements.md`](docs/improvements.md) for the backlog.

```sh
# Validate all specs and changes (use npx if the CLI is not on PATH)
openspec validate --all --strict

# Inspect the project roots and active changes
openspec context
openspec list
```

OpenCode commands: `/opsx-propose`, `/opsx-apply`, `/opsx-archive`,
`/opsx-sync`, `/opsx-update`, `/opsx-explore`.

## Notes

- The project targets **C++17** (`CMAKE_CXX_STANDARD 17`) to support aggregate
  initialization in the upstream xatlas source without modifications.
- Threading is disabled (`XA_MULTITHREADED=0`) for the WASM build. “Worker
  support” means running the whole module inside a Web Worker, not pthreads.
- The C API is enabled (`XATLAS_C_API=1`) for use from JavaScript via the
  accessor layer in `src/xatlas_wasm.c`.
- The build emits a separate `dist/xatlas.wasm`; the rationale and measured
  trade-off are documented in the improvement backlog.
- `build/` and `dist/` are gitignored build outputs; do not commit them.
