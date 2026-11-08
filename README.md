# xatlas-wasm

WebAssembly build of [xatlas](https://github.com/jpcy/xatlas) — a small C++17
library that generates unique texture coordinates suitable for lightmap baking
or texture painting. This package wraps xatlas in an ES module you can use from
Node.js or the browser.

## Status

The WASM binary ships as a separate `dist/xatlas.wasm` beside the package entry
and is loaded on demand. `createXAtlas(options?)` supports `wasmBinary`,
`locateFile`, `print` and `printErr`, and the module runs in Node.js, browsers
and workers. Known limitations and the remaining API improvements are tracked
in the
[improvement backlog](https://github.com/mode777/xatlas-wasm/blob/main/docs/improvements.md).

## Install

```sh
npm install xatlas-wasm
```

Requires Node.js >= 16 or a modern browser with WebAssembly. The package is
ESM-only.

## Quick Start

```js
import createXAtlas from 'xatlas-wasm';

const xatlas = await createXAtlas();
const atlas = xatlas.createAtlas();

// A unit quad: 4 vertices, 2 triangles.
const positions = new Float32Array([
  0, 0, 0,
  1, 0, 0,
  1, 1, 0,
  0, 1, 0,
]);
const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);

const error = atlas.addMesh({ positions, indices });
if (error !== xatlas.AddMeshError.Success) {
  throw new Error(xatlas.addMeshErrorString(error));
}

atlas.generate();
const mesh = atlas.getMesh(0);

// mesh.vertices[i].uv    — atlas UV coordinates in texel space
// mesh.vertices[i].xref  — index of the original input vertex

atlas.destroy();
```

`positions` is a flat `Float32Array` of `x, y, z` values. `indices` must be a
`Uint16Array` or `Uint32Array`; other typed arrays are not supported and
currently produce incorrect results (XW-006). Output UVs are in atlas texel
space — divide by `atlas.width` and `atlas.height` to normalize them. Call
`destroy()` when finished to free the WASM memory.

## Browser

The same import works in a browser. The package ships `dist/xatlas.wasm` beside
`dist/index.mjs`; bundlers that understand `new URL(..., import.meta.url)`
(Vite, webpack 5, Rollup) emit the asset automatically. Without a bundler,
serve or copy `xatlas.wasm` next to `index.mjs`, or pass `locateFile` or
`wasmBinary` to `createXAtlas()`.

## Loader Options

```js
// Custom asset URL
const xatlas = await createXAtlas({
  locateFile: (path) => `/static/wasm/${path}`,
});

// Explicit bytes: the binary is not fetched
const wasmBinary = await (await fetch('/assets/xatlas.wasm')).arrayBuffer();
const xatlasFromBytes = await createXAtlas({ wasmBinary });
```

`wasmBinary` takes precedence over `locateFile`. Invalid option types reject
with a `TypeError` naming the option; a missing artifact rejects with an error
naming `xatlas.wasm`. See the [API Reference](API.md#createxatlasoptions) for
the full contract.

## Workers

The kernel is single-threaded, so worker support means running a whole module
instance inside a worker — not pthreads or shared memory. The package is built
for the `worker` Emscripten environment in addition to Node and browsers.

Browser module worker:

```js
// atlas-worker.js
import createXAtlas from 'xatlas-wasm';

const xatlas = await createXAtlas();
const atlas = xatlas.createAtlas();
// addMesh() + generate() as usual
self.postMessage({ width: atlas.width, height: atlas.height });
atlas.destroy();
```

```js
// main.js
const worker = new Worker(new URL('./atlas-worker.js', import.meta.url), {
  type: 'module',
});
worker.onmessage = ({ data }) => console.log(data);
```

Node worker thread:

```js
// atlas-worker.mjs
import { parentPort } from 'node:worker_threads';
import createXAtlas from 'xatlas-wasm';

const xatlas = await createXAtlas();
const atlas = xatlas.createAtlas();
// addMesh() + generate() as usual
parentPort.postMessage({ width: atlas.width, height: atlas.height });
atlas.destroy();
```

```js
// main.mjs
import { Worker } from 'node:worker_threads';

const worker = new Worker(new URL('./atlas-worker.mjs', import.meta.url));
worker.on('message', console.log);
```

The worker test in `test/worker-entry.mjs` follows the Node recipe.

## Documentation

- **[API Reference](https://github.com/mode777/xatlas-wasm/blob/main/API.md)** — types, options, enumerations and examples.
- **[Build Guide](https://github.com/mode777/xatlas-wasm/blob/main/BUILD.md)** — compiling and testing the WASM module.
- **[Improvement Backlog](https://github.com/mode777/xatlas-wasm/blob/main/docs/improvements.md)** — WASM loading audit, comparison with libfive-wasm, and the proposed OpenSpec change sequence.
- **[OpenSpec Project](https://github.com/mode777/xatlas-wasm/tree/main/openspec)** — project context, specs, and active change proposals.

## Development

Local builds use **Emscripten 3.1.64**, the same version both CI workflows pin.

```sh
source ../emsdk/emsdk_env.sh   # activate the 3.1.64 emsdk
npm ci
npm run build                  # configures automatically when build/ is absent
npm test                       # Node smoke test
npm run test:package           # packed-tarball consumer test
```

`npm run build` runs `npm run configure` automatically when
`build/CMakeCache.txt` is missing. `npm run clean` removes `build/` and `dist/`
with `rm -rf`, so it needs a Unix-like shell (Linux or macOS, or Git Bash/WSL
on Windows). `npm test` prints a build hint naming `npm run build` when
`dist/index.mjs` or `dist/xatlas.wasm` is missing.

`npm run test:package` packs the real tarball, installs it into a scratch
project under the OS temp directory, runs a Node consumer (including
`getImage()`), typechecks a TypeScript consumer with loader options and builds
a Vite consumer that must emit the `.wasm` asset. The scratch tree is kept on
failure; `KEEP_PACKAGE_TEST=1` keeps it after a successful run, and
`TEST_PACKAGE_DROP=<file>` is a maintainer-only hook for proving a deliberately
broken package fails (not used in CI). The test still does not require a root
`LICENSE` (XW-018).

CI runs the build, smoke, loader, worker and package-consumer tests on every
push to `main` and every pull request, with Emscripten 3.1.64 and Node 24; see the
[Build Guide](https://github.com/mode777/xatlas-wasm/blob/main/BUILD.md#continuous-integration).

Functional work is planned and implemented through OpenSpec changes under
`openspec/changes/`; see [AGENTS.md](https://github.com/mode777/xatlas-wasm/blob/main/AGENTS.md) for the repository workflow and
the [improvement backlog](https://github.com/mode777/xatlas-wasm/blob/main/docs/improvements.md)
for the proposed sequence.

## License

MIT — see [thirdparty/xatlas/LICENSE](https://github.com/mode777/xatlas-wasm/blob/main/thirdparty/xatlas/LICENSE) for the upstream xatlas license.
