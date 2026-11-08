import { describe, expect, it } from 'vitest';
import { decodeAtlasRgba } from '../src/render/atlas-image.js';
import { chartColorRgb } from '../src/render/palette.js';
import type { ScenarioImage } from '../src/worker/run-scenario.js';

function imageWithPixels(): ScenarioImage {
  const width = 2;
  const height = 2;
  const atlasCount = 2;
  const data = new Uint32Array(atlasCount * width * height);
  data[0] = 0x80000000 | 3; // chart 3
  data[1] = 0x80000000 | 0x40000000 | 5; // bilinear, chart 5
  data[2] = 0x80000000 | 0x20000000 | 5; // padding, chart 5
  data[3] = 0; // empty
  return { width, height, atlasCount, data };
}

describe('atlas image decoding', () => {
  it('distinguishes chart, bilinear, padding and empty texels', () => {
    const decoded = decodeAtlasRgba(imageWithPixels(), 0);
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    expect(decoded.rgba.length).toBe(2 * 2 * 4);

    // The source row 0 is the bottom of the atlas; the decoded array is
    // flipped so row 0 is the top, matching canvas and PNG conventions.
    expect([...decoded.rgba.slice(0, 3)]).toEqual(
      [...chartColorRgb(5, 0.3)],
    );
    expect(decoded.rgba[3]).toBe(255);

    expect(decoded.rgba[7]).toBe(0);

    expect([...decoded.rgba.slice(8, 11)]).toEqual(
      [...chartColorRgb(3, 0.56)],
    );
    expect(decoded.rgba[11]).toBe(255);

    expect([...decoded.rgba.slice(12, 15)]).toEqual(
      [...chartColorRgb(5, 0.4)],
    );
    expect(decoded.rgba[15]).toBe(255);
  });

  it('slices the requested sub-atlas and clamps the index', () => {
    const image = imageWithPixels();
    const second = decodeAtlasRgba(image, 1);
    expect(second.rgba.every((value) => value === 0)).toBe(true);

    const clamped = decodeAtlasRgba(image, 99);
    expect(clamped.rgba.every((value) => value === 0)).toBe(true);
  });
});
