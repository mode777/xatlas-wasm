import { describe, expect, it } from 'vitest';
import { serializeObj } from '../src/export/obj.js';
import type { ScenarioRun } from '../src/worker/run-scenario.js';

function triangleRun(): ScenarioRun {
  return {
    demoId: 'test',
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
    stats: {
      outputVertexCount: 3,
      outputIndexCount: 3,
    },
  } as unknown as ScenarioRun;
}

describe('OBJ export', () => {
  it('writes one v/vt pair per output vertex and one face per triangle', () => {
    const text = serializeObj(triangleRun());
    expect(text.match(/^v /gm)).toHaveLength(3);
    expect(text.match(/^vt /gm)).toHaveLength(3);
    expect(text.match(/^f /gm)).toHaveLength(1);
    expect(text).toContain('f 1/1 2/2 3/3');
  });

  it('rejects non-finite coordinates', () => {
    const run = triangleRun();
    (run.positions as Float32Array)[0] = Number.NaN;
    expect(() => serializeObj(run)).toThrow(/non-finite/);
  });
});
