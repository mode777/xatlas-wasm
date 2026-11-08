# Tasks

## 1. Separate WASM artifact

- [ ] 1.1 Update `CMakeLists.txt`: remove `SINGLE_FILE=1` and set `ENVIRONMENT=web,node,worker`; verify `npm run configure && npm run build` emits `dist/xatlas.mjs`, `dist/xatlas.wasm` and `dist/index.mjs`, and that `dist/index.mjs` contains no base64 WASM payload.
- [ ] 1.2 Update `BUILD.md`'s output table and the smoke-test preflight so `test/test.mjs` checks for both `dist/index.mjs` and `dist/xatlas.wasm`; verify moving `dist/xatlas.wasm` aside makes `npm test` exit non-zero with the `npm run build` hint, and restoring it makes the test pass.
- [ ] 1.3 Add a negative loader test that imports a copy of `dist/index.mjs` from a temporary directory without `xatlas.wasm` and verifies `createXAtlas()` rejects with an error naming `xatlas.wasm`; verify the test passes and the error preserves its cause.

## 2. Loader options API

- [ ] 2.1 Implement `createXAtlas(options?)` in `lib/xatlas.mjs`: validate `wasmBinary`, `locateFile`, `print` and `printErr`; normalize `wasmBinary` views; skip `locateFile` when bytes are supplied; forward logging callbacks; wrap factory failures with an error naming `xatlas.wasm`. Verify the new `test/loader.test.mjs` covers default resolution, a custom `locateFile`, `wasmBinary` precedence, invalid option types and the missing-artifact case.
- [ ] 2.2 Update `lib/xatlas.d.ts` (`CreateXAtlasOptions` and the default export) plus the `createXAtlas` sections of `API.md` and `README.md`; verify a strict TypeScript consumer accepts `createXAtlas({ wasmBinary, locateFile, print, printErr })` and rejects `wasmBinary: 'bytes'` with a type error.
- [ ] 2.3 Add `test/loader.test.mjs` to the `npm test` script (without the worker test yet) and verify `npm test` runs the smoke and loader tests successfully.

## 3. Worker support

- [ ] 3.1 Add `test/worker.test.mjs` and its worker entry so the built package initializes and generates a quad inside a Node worker thread; verify `npm test` reports non-zero worker atlas dimensions and fails non-zero when the worker errors.
- [ ] 3.2 Add the worker test to the `npm test` script and document the browser module-worker and Node `worker_threads` recipes in `README.md` and `API.md`; verify the documented snippet matches the worker test entry and `npm test` passes.

## 4. Neutral bundling and consumer coverage

- [ ] 4.1 Add `scripts/bundle.mjs` using esbuild `platform: 'neutral'`, `format: 'esm'` and externals `module`, `fs`, `path`, `url`; include the Node-module dynamic-import rewrite and fail if the Emscripten pattern is missing. Verify `npm run bundle` succeeds and `dist/index.mjs` contains no static `import("module")`.
- [ ] 4.2 Update `scripts/test-package.mjs` to require `dist/xatlas.wasm` in the tarball, exercise default Node resolution and TypeScript loader options, assert the Vite build emits and references a `.wasm` asset, and fail on the Node externalization warning. Verify `npm run test:package` passes and `TEST_PACKAGE_DROP=dist/xatlas.wasm npm run test:package` fails naming the missing artifact.
- [ ] 4.3 Update `BUILD.md`'s bundle/packed-package sections to describe the neutral bundle, the WASM asset checks and the Vite warning assertion; verify the documented `npm run test:package` command passes as written.

## 5. Package and CI surface

- [ ] 5.1 Add `dist/xatlas.wasm` to `package.json` `files` and to the artifact verification, digest/size lists, provenance and upload steps in `.github/workflows/build-wasm.yml` and `.github/workflows/publish.yml`; verify `npm pack --dry-run` lists `dist/xatlas.wasm` and every workflow digest list contains it.
- [ ] 5.2 Update `docs/improvements.md` to mark XW-001–XW-005 implemented (recording the deferred license clause under XW-018) and refresh `README.md` status/browser text; verify no current-behavior text still claims there is no separate `.wasm`, that `createXAtlas()` takes no options, or that `SINGLE_FILE=1` is active.
- [ ] 5.3 Record the built artifact sizes and the Vite consumer result in `docs/improvements.md`; verify the recorded numbers match a fresh `npm run build` and `npm run test:package` run.

## 6. Integration verification

- [ ] 6.1 Run a clean integration pass: `npm run clean && npm run build && npm test && npm run test:package`; verify all commands exit 0 and the packed tarball contains `dist/index.mjs` and `dist/xatlas.wasm`.
- [ ] 6.2 Serve the example with `npm run example` and verify in a browser that the network panel requests `dist/xatlas.wasm`, the atlas renders, and `createXAtlas({ locateFile })` works with a custom URL.
- [ ] 6.3 Run `openspec validate --all --strict` and verify it passes before archive.

## Workflow follow-up

- Review the implemented change against the specs and measured evidence.
- Archive the change after review and verify the synced specs and archived change directory.
