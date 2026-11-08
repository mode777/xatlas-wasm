const GOLDEN_ANGLE = 137.508;
const SATURATION = 0.62;

export type Rgb = readonly [number, number, number];

function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  const h = ((hue % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

/** Deterministic, well-separated chart colors. */
export function chartColor(index: number, lightness = 0.52): string {
  if (index < 0) return 'hsl(210, 8%, 48%)';
  return `hsl(${(index * GOLDEN_ANGLE) % 360}, ${SATURATION * 100}%, ${
    lightness * 100
  }%)`;
}

export function chartColorRgb(index: number, lightness = 0.52): Rgb {
  if (index < 0) return [122, 128, 136];
  return hslToRgb((index * GOLDEN_ANGLE) % 360, SATURATION, lightness);
}

export function rgbToCss([r, g, b]: Rgb): string {
  return `rgb(${r} ${g} ${b})`;
}
