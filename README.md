# xatlas-wasm

WebAssembly build of [xatlas](https://github.com/jpcy/xatlas) — a small C++17
library that generates unique texture coordinates suitable for lightmap baking
or texture painting. This package wraps xatlas in an ES module you can use from
Node.js or the browser.

## Status

Current release: **0.1.3**. The WASM binary is embedded in the JavaScript
bundle (`SINGLE_FILE=1`), so no separate `.wasm` asset is shipped or fetched at
runtime, and `createXAtlas()` currently takes no options. Known limitations and
the planned loader/API improvements are tracked in the
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

The same import works in a browser. Because the current build embeds the WASM
inside the JavaScript bundle, there is no `.wasm` request and no server MIME
configuration to worry about. A separate, lazily fetched `.wasm` artifact is
planned in the improvement backlog.

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
`dist/index.mjs` is missing.

`npm run test:package` packs the real tarball, installs it into a scratch
project under the OS temp directory, runs a Node consumer (including
`getImage()`), typechecks a TypeScript consumer and builds a Vite consumer.
The scratch tree is kept on failure; `KEEP_PACKAGE_TEST=1` keeps it after a
successful run, and `TEST_PACKAGE_DROP=<file>` is a maintainer-only hook for
proving a deliberately broken package fails (not used in CI). The test
intentionally does not expect a separate `.wasm` asset (`SINGLE_FILE=1` today;
XW-001) and does not require a root `LICENSE` yet (XW-018).

CI runs the same build, smoke test and consumer test on every push to `main`
and every pull request, with Emscripten 3.1.64 and Node 24; see the
[Build Guide](https://github.com/mode777/xatlas-wasm/blob/main/BUILD.md#continuous-integration).

Functional work is planned and implemented through OpenSpec changes under
`openspec/changes/`; see [AGENTS.md](https://github.com/mode777/xatlas-wasm/blob/main/AGENTS.md) for the repository workflow and
the [improvement backlog](https://github.com/mode777/xatlas-wasm/blob/main/docs/improvements.md)
for the proposed sequence.

## License

MIT — see [thirdparty/xatlas/LICENSE](https://github.com/mode777/xatlas-wasm/blob/main/thirdparty/xatlas/LICENSE) for the upstream xatlas license.
