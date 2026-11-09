import createXAtlas, { type XAtlasModule } from 'xatlas-wasm';
import { beforeAll, describe, expect, it } from 'vitest';
import { gazeboObj } from '../src/demos/assets/gazebo.js';
import { milkTruckGeometry } from '../src/demos/assets/milk-truck.js';
import { demos, getDemo } from '../src/demos/index.js';
import { parseObjInput } from '../src/demos/obj.js';
import { createTownLevel } from '../src/demos/town.js';
import type { DemoInput } from '../src/demos/types.js';
import { runScenario } from '../src/worker/run-scenario.js';

let xatlas: XAtlasModule;

beforeAll(async () => {
  xatlas = await createXAtlas();
});

describe('scenario unwrapping', () => {
  for (const demo of demos) {
    it(
      `${demo.meta.id} unwraps to valid geometry`,
      () => {
        const run = runScenario(xatlas, demo);

        expect(run.stats.width).toBeGreaterThan(0);
        expect(run.stats.height).toBeGreaterThan(0);
        expect(run.stats.chartCount).toBeGreaterThan(0);
        expect(run.stats.atlasCount).toBeGreaterThan(0);
        expect(run.stats.outputVertexCount).toBeGreaterThan(0);
        expect(run.stats.outputIndexCount).toBeGreaterThan(0);
        expect(run.positions.length).toBe(run.stats.outputVertexCount * 3);
        expect(run.uvs.length).toBe(run.stats.outputVertexCount * 2);
        expect(run.indices.length).toBe(run.stats.outputIndexCount);

        for (const value of run.positions) {
          expect(Number.isFinite(value)).toBe(true);
        }
        for (const value of run.uvs) {
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(-1e-6);
          expect(value).toBeLessThanOrEqual(1 + 1e-6);
        }
        for (const index of run.indices) {
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThan(run.stats.outputVertexCount);
        }

        if (demo.packOptions?.createImage) {
          expect(run.image).not.toBeNull();
          expect(run.image!.width).toBe(run.stats.width);
          expect(run.image!.height).toBe(run.stats.height);
          expect(run.image!.atlasCount).toBe(run.stats.atlasCount);
          expect(run.image!.data.length).toBe(
            run.image!.atlasCount * run.image!.width * run.image!.height,
          );
        }
      },
      60_000,
    );
  }

  it('multi-atlas produces more than one sub-atlas', () => {
    const demo = getDemo('multi-atlas');
    expect(demo).toBeDefined();
    const run = runScenario(xatlas, demo!);
    expect(run.stats.atlasCount).toBeGreaterThan(1);
  });

  it('town-level adds every composed mesh to the atlas', () => {
    const demo = getDemo('town-level');
    expect(demo).toBeDefined();
    const truck: DemoInput = {
      kind: 'mesh',
      positions: milkTruckGeometry.positions,
      indices: milkTruckGeometry.indices,
    };
    const level = createTownLevel(parseObjInput(gazeboObj), truck);
    const run = runScenario(xatlas, demo!);

    expect(level.length).toBeGreaterThan(1);
    expect(run.stats.meshCount).toBe(level.length);
    expect(run.stats.inputVertexCount).toBe(
      level.reduce((total, mesh) => total + mesh.positions!.length / 3, 0),
    );
    expect(run.stats.inputFaceCount).toBe(
      level.reduce((total, mesh) => total + mesh.indices.length / 3, 0),
    );
    expect(run.stats.outputVertexCount).toBe(run.positions.length / 3);
    expect(run.stats.outputIndexCount).toBe(run.indices.length);
  });
});
