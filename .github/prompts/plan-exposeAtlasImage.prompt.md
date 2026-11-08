# Plan: Expose the atlas image (`getImage()`)

**TL;DR:** The WASM build already exports `xatlasAtlas_getImage` and `PackOptions.createImage` is already wired through the JS wrapper, but there is no way to read the image from JavaScript — even though `lib/xatlas.d.ts` promises it is "accessible from the atlas result". Add a `getImage()` method that copies the image out of the WASM heap, export the pixel bit-format constants, update the TypeScript definitions and `API.md`, and cover it with tests.

## Background / Key Findings

- `PackOptions.createImage` (default `false`) makes xatlas allocate `Atlas::image` during packing — see `thirdparty/xatlas/source/xatlas/xatlas.cpp:9610-9613`: `atlasCount * width * height` `uint32_t` elements, `nullptr` otherwise.
- The image is **not** RGBA color data. Each pixel is a bitfield (`xatlas.h:78-81`, mirrored in `xatlas_c.h:108-111`):
  - `kImageChartIndexMask = 0x1FFFFFFF` — chart index
  - `kImageHasChartIndexBit = 0x80000000` — texel covered by a chart
  - `kImageIsBilinearBit = 0x40000000` — texel added for bilinear filtering safety
  - `kImageIsPaddingBit = 0x20000000` — padding (dilated) texel
- The C accessor already exists and is exported: `src/xatlas_wasm.c:28` (`_xatlasAtlas_getImage` is in `CMakeLists.txt` `EXPORTED_FUNCTIONS`). **No C/CMake changes are needed.**
- The JS wrapper writes `createImage` into `PackOptions` (`lib/xatlas.mjs:469`) but never reads the image back — `lib/xatlas.d.ts:179-182` documents a contract ("Create the atlas image (accessible from the atlas result)") that the library does not currently fulfill. `API.md` documents `createImage` (line 426) without documenting how to access the result.
- `getImage()` must return `null` when the atlas pointer field is `0` (image not created, or before `generate()`).

## Steps

### Phase 1: JS wrapper (`lib/xatlas.mjs`)

1. Add an `AtlasImage` result to the `XAtlas` class:
   - `getImage()` → `{ width, height, atlasCount, data: Uint32Array }` or `null`
   - `data.length === atlasCount * width * height`; sub-atlas `i` occupies `data.subarray(i * width * height, (i + 1) * width * height)`
   - Read via `m._xatlasAtlas_getImage(this._ptr)`; if the pointer is `0`, return `null`; otherwise copy with the existing `HEAPU32.buffer.slice(ptr, ptr + byteLength)` pattern used in `getMesh()` (`lib/xatlas.mjs:383-386`) so the result stays valid after `destroy()`
2. Export frozen pixel-format constants alongside the existing enums: `ImageChartIndexMask (0x1FFFFFFF)`, `ImageHasChartIndexBit (0x80000000)`, `ImageIsBilinearBit (0x40000000)`, `ImageIsPaddingBit (0x20000000)`, and expose them on the object returned by `createXAtlas()`
3. Add a small decode helper, e.g. `decodeImagePixel(pixel)` → `{ chartIndex: number, hasChartIndex: boolean, isBilinear: boolean, isPadding: boolean }`, exported from the module for consumers who don't want to do bit math

### Phase 2: Types and docs

4. `lib/xatlas.d.ts` — add `AtlasImage` interface, `getImage(): AtlasImage | null` on the atlas type, the four `Image*` constants, and `decodeImagePixel`; fix the `createImage` JSDoc to reference `getImage()`
5. `API.md` — new `getImage()` section under the atlas methods: return shape, sub-atlas layout, the pixel bitfield table, a usage snippet (e.g. count covered texels or build a debug canvas), and the `null` cases (default `createImage: false`, or called before `generate()`)

### Phase 3: Tests

6. Extend `test/test.mjs` (or add `test/image.test.mjs` run from it):
   - after `generate({}, { createImage: true })`: `getImage()` is non-null; `data.length === atlasCount * width * height`; at least one pixel has `ImageHasChartIndexBit`; every chart index extracted with `ImageChartIndexMask` is `< chartCount`
   - default path: `getImage()` returns `null` (createImage defaults to false)
   - the copied `Uint32Array` remains readable after `atlas.destroy()` (no dangling heap view)

### Phase 4 (optional): Example

7. `example/main.mjs` — after generating with `createImage: true`, render the atlas image to a canvas (color texels by chart index, dim padding/bilinear texels) as a third debug view

## Relevant Files

- [lib/xatlas.mjs](lib/xatlas.mjs) — `getImage()`, constants, decode helper (~line 383 for the copy pattern)
- [lib/xatlas.d.ts](lib/xatlas.d.ts) — types for the new API (~line 179 for the `createImage` doc fix)
- [API.md](API.md) — new section; update `createImage` row (~line 426)
- [test/test.mjs](test/test.mjs) — image assertions
- [example/main.mjs](example/main.mjs) — optional debug view
- Reference only: `src/xatlas_wasm.c:28`, `CMakeLists.txt` (no changes), `thirdparty/xatlas/source/xatlas/xatlas.h:78-86`

## Verification

1. `npm run configure && npm run build` (requires emsdk), then `npm test` — all existing checks plus the new image assertions pass
2. `grep -n "xatlasAtlas_getImage" lib/xatlas.mjs` shows the wrapper now calls the exported accessor
3. Confirm no C/CMake diff: `git diff --stat src/ CMakeLists.txt` is empty
4. Optional: `npm run example`, load the default mesh in a browser, see the rendered atlas image view

## Decisions

- **JS-only change**: `_xatlasAtlas_getImage` is already compiled and exported; the WASM surface and build flags stay untouched
- **Copy, don't view**: return a `Uint32Array` copy (`.slice`) instead of a live `HEAPU32` view, matching `getMesh()` semantics — safe against heap growth/reallocation and `destroy()`
- **One call, all atlases**: return the full `atlasCount * width * height` buffer with `subarray` offsets documented, rather than a per-atlas getter — mirrors the flat C layout and keeps the API surface minimal
- **Constants over enum**: the pixel bits are masks, not an enumeration; frozen number constants mirror `xatlas_c.h`
- **`null` over throw**: a missing image is a normal state (default options), not an error

## Further Considerations

1. **CI on push/PR**: `.github/workflows/publish.yml` builds and tests only on release. A `ci.yml` running configure/build/test on every push and pull request would catch breakage (including this change) before publish — recommended as a separate follow-up plan.
2. **`paramFunc` support**: `ChartOptions.paramFunc` is explicitly skipped in `_writeChartOptions` (`lib/xatlas.mjs:413`); supporting it via `addFunction` (like `setProgressCallback`) would complete the chart options surface.
3. **Convenience colorizer**: `decodeImagePixel` could grow a `toRGBA()` sibling that maps chart indices to a debug palette, but canvas consumers can do this in one line; defer until requested.
