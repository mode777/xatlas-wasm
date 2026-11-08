import type { DemoInput } from './types.js';

/**
 * A unit cube with eight shared vertices and twelve outward-wound triangles.
 * There are no normals or UVs: xatlas derives the charts from the geometry.
 */
export function createCube(size = 1): DemoInput {
  const h = size / 2;
  const positions = new Float32Array([
    -h, -h, -h,
    h, -h, -h,
    h, h, -h,
    -h, h, -h,
    -h, -h, h,
    h, -h, h,
    h, h, h,
    -h, h, h,
  ]);
  const indices = new Uint32Array([
    0, 3, 2, 0, 2, 1,
    4, 5, 6, 4, 6, 7,
    0, 4, 7, 0, 7, 3,
    1, 2, 6, 1, 6, 5,
    0, 1, 5, 0, 5, 4,
    3, 7, 6, 3, 6, 2,
  ]);
  return { kind: 'mesh', positions, indices };
}

/**
 * A UV sphere with duplicated seam vertices and outward-wound triangles. The
 * formula matches the three.js sphere grid (without depending on three.js), so
 * the pole caps skip the degenerate triangles.
 */
export function createUvSphere(
  radius = 1,
  segments = 32,
  rings = 16,
): DemoInput {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const grid: number[][] = [];

  for (let iy = 0; iy <= rings; iy++) {
    const v = iy / rings;
    const row: number[] = [];
    for (let ix = 0; ix <= segments; ix++) {
      const u = ix / segments;
      const phi = u * Math.PI * 2;
      const theta = v * Math.PI;
      const sinTheta = Math.sin(theta);
      const x = -radius * Math.cos(phi) * sinTheta;
      const y = radius * Math.cos(theta);
      const z = radius * Math.sin(phi) * sinTheta;
      row.push(positions.length / 3);
      positions.push(x, y, z);
      const length = Math.hypot(x, y, z) || 1;
      normals.push(x / length, y / length, z / length);
    }
    grid.push(row);
  }

  for (let iy = 0; iy < rings; iy++) {
    for (let ix = 0; ix < segments; ix++) {
      const a = grid[iy]![ix + 1]!;
      const b = grid[iy]![ix]!;
      const c = grid[iy + 1]![ix]!;
      const d = grid[iy + 1]![ix + 1]!;
      if (iy !== 0) indices.push(a, b, d);
      if (iy !== rings - 1) indices.push(b, c, d);
    }
  }

  return {
    kind: 'mesh',
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  };
}

function terrainHeight(x: number, z: number, amplitude: number): number {
  return (
    amplitude *
    (Math.sin(x * 1.7) * Math.cos(z * 1.3) +
      0.35 * Math.sin(x * 3.1 + z * 2.2))
  );
}

/**
 * A subdivided heightfield. The mesh is a single connected surface, so chart
 * options can be used to trade chart count against distortion.
 */
export function createTerrain(
  size = 5,
  segments = 32,
  amplitude = 0.5,
): DemoInput {
  const count = segments + 1;
  const positions = new Float32Array(count * count * 3);
  const indices: number[] = [];

  for (let iz = 0; iz < count; iz++) {
    for (let ix = 0; ix < count; ix++) {
      const x = (ix / segments - 0.5) * size;
      const z = (iz / segments - 0.5) * size;
      const offset = (iz * count + ix) * 3;
      positions[offset] = x;
      positions[offset + 1] = terrainHeight(x, z, amplitude);
      positions[offset + 2] = z;
    }
  }

  for (let iz = 0; iz < segments; iz++) {
    for (let ix = 0; ix < segments; ix++) {
      const a = iz * count + ix;
      const b = (iz + 1) * count + ix;
      const c = (iz + 1) * count + ix + 1;
      const d = iz * count + ix + 1;
      indices.push(a, b, c, a, c, d);
    }
  }

  return {
    kind: 'mesh',
    positions,
    indices: new Uint32Array(indices),
  };
}

/**
 * Many disconnected, slightly rotated quads. Each panel becomes its own chart,
 * which makes padding, bilinear bands and packing strategies visible.
 */
export function createPackingPanels(panelCount = 36): DemoInput {
  const count = Math.max(1, panelCount);
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const spacing = 1.45;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < count; i++) {
    const column = i % columns;
    const row = Math.floor(i / columns);
    const centerX = (column - (columns - 1) / 2) * spacing;
    const centerY = (row - (rows - 1) / 2) * spacing;
    const size = 0.45 + (((i * 37) % 53) / 53) * 0.75;
    const angle = (((i * 23) % 360) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const z = 0.12 * Math.sin(i * 1.7);
    const base = positions.length / 3;

    for (const [localX, localY] of [
      [-size / 2, -size / 2],
      [size / 2, -size / 2],
      [size / 2, size / 2],
      [-size / 2, size / 2],
    ] as const) {
      positions.push(
        centerX + localX * cos - localY * sin,
        centerY + localX * sin + localY * cos,
        z,
      );
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  return {
    kind: 'mesh',
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}

/** A dense, wavy grid used to force a run into more than one sub-atlas. */
export function createDenseGrid(
  size = 6,
  segments = 48,
  amplitude = 0.4,
): DemoInput {
  return createTerrain(size, segments, amplitude);
}
