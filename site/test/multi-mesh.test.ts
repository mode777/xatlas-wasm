import createXAtlas, { type XAtlasModule } from 'xatlas-wasm';
import { beforeAll, describe, expect, it } from 'vitest';
import { addMeshes } from '../src/demos/mesh.js';
import type { DemoDefinition, DemoInput } from '../src/demos/types.js';
import { runScenario } from '../src/worker/run-scenario.js';

const meshA: DemoInput = {
  kind: 'mesh',
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
};

const meshB: DemoInput = {
  kind: 'mesh',
  positions: new Float32Array([2, 0, 0, 3, 0, 0, 3, 1, 0, 2, 1, 0]),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
};

const twoMeshDemo: DemoDefinition = {
  meta: {
    id: 'two-mesh-fixture',
    title: 'Two-mesh fixture',
    description: 'Two disconnected quads added as separate xatlas meshes.',
    features: ['test'],
    input: 'generated',
  },
  packOptions: {
    createImage: true,
    padding: 1,
    bilinear: true,
  },
  build(context) {
    return addMeshes(context, [meshA, meshB]);
  },
};

let xatlas: XAtlasModule;

beforeAll(async () => {
  xatlas = await createXAtlas();
});

describe('multi-mesh scenario results', () => {
  it('flattens every mesh and offsets combined indices', () => {
    const run = runScenario(xatlas, twoMeshDemo);

    expect(run.stats.meshCount).toBe(2);
    expect(run.stats.inputVertexCount).toBe(8);
    expect(run.stats.inputFaceCount).toBe(4);
    expect(run.stats.outputVertexCount).toBeGreaterThan(0);
    expect(run.stats.outputIndexCount).toBeGreaterThan(0);
    expect(run.positions.length).toBe(run.stats.outputVertexCount * 3);
    expect(run.uvs.length).toBe(run.stats.outputVertexCount * 2);
    expect(run.indices.length).toBe(run.stats.outputIndexCount);
    expect(run.chartIds.length).toBe(run.stats.outputVertexCount);
    expect(run.atlasIds.length).toBe(run.stats.outputVertexCount);

    const sourceKeys = new Set<string>();
    for (const mesh of [meshA, meshB]) {
      for (let i = 0; i < mesh.positions!.length; i += 3) {
        sourceKeys.add(
          `${mesh.positions![i]},${mesh.positions![i + 1]},${mesh.positions![i + 2]}`,
        );
      }
    }

    let sawSecondMesh = false;
    for (let i = 0; i < run.positions.length; i += 3) {
      const key = `${run.positions[i]},${run.positions[i + 1]},${run.positions[i + 2]}`;
      expect(sourceKeys.has(key)).toBe(true);
      if (run.positions[i]! >= 2) sawSecondMesh = true;
    }
    expect(sawSecondMesh).toBe(true);

    for (const index of run.indices) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(run.stats.outputVertexCount);
    }
  });
});
