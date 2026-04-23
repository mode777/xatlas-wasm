# xatlas-wasm

WebAssembly build of [xatlas](https://github.com/jpcy/xatlas) — a small C++17 library that generates unique texture coordinates suitable for lightmap baking or texture painting. This package wraps xatlas in an ES module you can use from Node.js or the browser.

## Quick Start

```js
import createXAtlas from 'xatlas-wasm';

const xatlas = await createXAtlas();
const atlas = xatlas.createAtlas();

atlas.addMesh({ positions, indices });
atlas.generate();

const mesh = atlas.getMesh(0);
// mesh.vertices[i].uv  — atlas UV coordinates
// mesh.vertices[i].xref — index of the original input vertex

atlas.destroy();
```

## Documentation

- **[API Reference](API.md)** — Full API documentation including types, options, enumerations, and usage examples.
- **[Build Guide](BUILD.md)** — Instructions for compiling the WASM module from source with Emscripten.

## License

MIT — see `thirdparty/xatlas/LICENSE` for the upstream xatlas license.
