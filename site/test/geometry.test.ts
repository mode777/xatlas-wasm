import { describe, expect, it } from 'vitest';
import {
  createDenseGrid,
  createPackingPanels,
  createUvSphere,
} from '../src/demos/geometry.js';
import {
  createTownLevel,
  mergeMeshes,
  transformMesh,
} from '../src/demos/town.js';
import type { DemoInput } from '../src/demos/types.js';

function expectValidMesh(mesh: DemoInput): void {
  expect(mesh.kind).toBe('mesh');
  expect(mesh.positions).toBeDefined();
  expect(mesh.positions!.length % 3).toBe(0);
  expect(mesh.indices.length % 3).toBe(0);
  expect(mesh.indices.length).toBeGreaterThan(0);
  const vertexCount = mesh.positions!.length / 3;
  for (const value of mesh.positions!) expect(Number.isFinite(value)).toBe(true);
  if (mesh.normals) {
    expect(mesh.normals.length).toBe(mesh.positions!.length);
    for (const value of mesh.normals) expect(Number.isFinite(value)).toBe(true);
  }
  for (const index of mesh.indices) {
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(vertexCount);
  }
}

const quad: DemoInput = {
  kind: 'mesh',
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
};

describe('procedural meshes', () => {
  it('builds a finite UV sphere with normals', () => {
    const mesh = createUvSphere(1, 16, 8);
    expectValidMesh(mesh);
    expect(mesh.positions!.length).toBeGreaterThan(0);
    expect(mesh.normals).toBeDefined();
    expect(mesh.indices.length / 3).toBe(16 * 8 * 2 - 16 * 2);
  });

  it('builds disconnected packing panels', () => {
    const mesh = createPackingPanels(12);
    expectValidMesh(mesh);
    expect(mesh.positions!.length / 3).toBe(12 * 4);
    expect(mesh.indices.length / 3).toBe(12 * 2);
  });

  it('builds a dense multi-atlas grid', () => {
    const mesh = createDenseGrid(4, 12, 0.3);
    expectValidMesh(mesh);
    expect(mesh.positions!.length / 3).toBe(13 * 13);
    expect(mesh.indices.length / 3).toBe(12 * 12 * 2);
  });
});

describe('town helpers', () => {
  it('transforms positions without changing topology', () => {
    const transformed = transformMesh(quad, {
      x: 10,
      y: 2,
      z: -3,
      rotateY: Math.PI / 2,
      scale: 2,
    });
    expectValidMesh(transformed);
    expect(transformed.indices.length).toBe(quad.indices.length);
    expect(transformed.positions![0]).toBeCloseTo(10);
    expect(transformed.positions![1]).toBeCloseTo(2);
    expect(transformed.positions![2]).toBeCloseTo(-3);
    expect(transformed.positions![3]).toBeCloseTo(10);
    expect(transformed.positions![5]).toBeCloseTo(-5);
  });

  it('merges meshes and offsets their indices', () => {
    const merged = mergeMeshes([quad, quad]);
    expectValidMesh(merged);
    expect(merged.positions!.length).toBe(quad.positions!.length * 2);
    expect(merged.indices.length).toBe(quad.indices.length * 2);
    expect(merged.indices[0]).toBe(0);
    expect(merged.indices[6]).toBe(4);
  });

  it('builds a multi-model town level from two inputs', () => {
    const level = createTownLevel(
      createUvSphere(1, 8, 4),
      createPackingPanels(1),
    );
    expect(level.length).toBeGreaterThan(1);
    for (const mesh of level) expectValidMesh(mesh);
  });
});
