import { describe, expect, it } from 'vitest';
import type { ScenarioRun } from '../src/worker/run-scenario.js';
import {
  triangleAtlasId,
  triangleChartId,
  uvToCanvas,
} from '../src/render/uv-layout.js';

const run = {
  indices: new Uint32Array([0, 1, 2, 3, 1, 0]),
  atlasIds: new Int32Array([4, 4, 4, 1]),
  chartIds: new Int32Array([9, 9, 9, 2]),
} as unknown as ScenarioRun;

describe('UV layout helpers', () => {
  it('maps bottom-left UVs to canvas coordinates', () => {
    expect(uvToCanvas(0, 0, 100, 50)).toEqual([0, 50]);
    expect(uvToCanvas(1, 1, 100, 50)).toEqual([100, 0]);
    expect(uvToCanvas(0.5, 0.5, 100, 50)).toEqual([50, 25]);
  });

  it('reads the atlas and chart id of a triangle', () => {
    expect(triangleAtlasId(run, 0)).toBe(4);
    expect(triangleChartId(run, 0)).toBe(9);
    expect(triangleAtlasId(run, 1)).toBe(1);
    expect(triangleChartId(run, 1)).toBe(2);
    expect(triangleAtlasId(run, 99)).toBe(-1);
  });
});
