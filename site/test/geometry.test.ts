import { describe, expect, it } from 'vitest';
import {
  createCube,
  createDenseGrid,
  createPackingPanels,
  createTerrain,
  createUvSphere,
} from '../src/demos/geometry.js';
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

describe('procedural meshes', () => {
  it('builds a cube with eight vertices and twelve triangles', () => {
    const mesh = createCube(1);
    expectValidMesh(mesh);
    expect(mesh.positions!.length / 3).toBe(8);
    expect(mesh.indices.length / 3).toBe(12);
  });

  it('builds a finite UV sphere with normals', () => {
    const mesh = createUvSphere(1, 16, 8);
    expectValidMesh(mesh);
    expect(mesh.positions!.length).toBeGreaterThan(0);
    expect(mesh.normals).toBeDefined();
    expect(mesh.indices.length / 3).toBe(16 * 8 * 2 - 16 * 2);
  });

  it('builds a terrain grid', () => {
    const mesh = createTerrain(4, 8, 0.4);
    expectValidMesh(mesh);
    expect(mesh.positions!.length / 3).toBe(9 * 9);
    expect(mesh.indices.length / 3).toBe(8 * 8 * 2);
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
