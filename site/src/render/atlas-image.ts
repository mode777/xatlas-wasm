import { decodeImagePixel } from 'xatlas-wasm';
import type { ScenarioImage } from '../worker/run-scenario.js';
import { chartColorRgb } from './palette.js';

export interface DecodedAtlas {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8ClampedArray;
}

/**
 * Decode one sub-atlas of the raw bitfield into RGBA. Chart texels use the
 * chart palette; padding and bilinear texels are dimmed; empty texels are
 * transparent.
 */
export function decodeAtlasRgba(
  image: ScenarioImage,
  atlasIndex: number,
): DecodedAtlas {
  const index = Math.max(0, Math.min(image.atlasCount - 1, atlasIndex));
  const texelCount = image.width * image.height;
  const offset = index * texelCount;
  const rgba = new Uint8ClampedArray(texelCount * 4);

  for (let i = 0; i < texelCount; i++) {
    const pixel = decodeImagePixel(image.data[offset + i]!);
    // xatlas rows run bottom-up (row 0 = v 0); canvas and PNG rows run
    // top-down, so write the mirrored output row.
    const x = i % image.width;
    const y = (i / image.width) | 0;
    const out = ((image.height - 1 - y) * image.width + x) * 4;

    if (pixel.hasChartIndex) {
      const lightness = pixel.isPadding ? 0.3 : pixel.isBilinear ? 0.4 : 0.56;
      const [r, g, b] = chartColorRgb(pixel.chartIndex, lightness);
      rgba[out] = r;
      rgba[out + 1] = g;
      rgba[out + 2] = b;
      rgba[out + 3] = 255;
    } else if (pixel.isBilinear || pixel.isPadding) {
      rgba[out] = 52;
      rgba[out + 1] = 62;
      rgba[out + 2] = 82;
      rgba[out + 3] = 255;
    } else {
      rgba[out + 3] = 0;
    }
  }

  return { width: image.width, height: image.height, rgba };
}
