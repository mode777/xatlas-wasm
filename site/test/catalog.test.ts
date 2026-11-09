import { describe, expect, it } from 'vitest';
import { demoMetaList, demos, getDemo } from '../src/demos/index.js';

const expectedIds = [
  'gazebo',
  'milk-truck',
  'town-level',
  'uv-sphere',
  'packing-lab',
  'multi-atlas',
];

describe('scenario catalog', () => {
  it('contains the six stable scenario ids', () => {
    expect(demos.map((demo) => demo.meta.id)).toEqual(expectedIds);
    expect(new Set(expectedIds).size).toBe(expectedIds.length);
  });

  it('looks up every scenario by id', () => {
    for (const id of expectedIds) {
      expect(getDemo(id)?.meta.id).toBe(id);
    }
    expect(getDemo('missing')).toBeUndefined();
  });

  it('provides complete metadata', () => {
    for (const meta of demoMetaList()) {
      expect(meta.title.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
      expect(meta.features.length).toBeGreaterThan(0);
      expect(['generated', 'asset']).toContain(meta.input);
    }
  });
});
