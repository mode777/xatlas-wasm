import { describe, expect, it } from 'vitest';
import { demos } from '../src/demos/index.js';
import {
  getScenarioSource,
  scenarioSourceIds,
} from '../src/demos/sources.js';

describe('scenario sources', () => {
  it('has one source for every catalog scenario', () => {
    const sourceIds = [...scenarioSourceIds()].sort();
    const demoIds = demos.map((demo) => demo.meta.id).sort();
    expect(sourceIds).toEqual(demoIds);
  });

  it('returns the module source used by the worker', () => {
    for (const demo of demos) {
      const source = getScenarioSource(demo.meta.id);
      expect(source.length).toBeGreaterThan(0);
      expect(source).toContain('export default demo');
      expect(source).toContain(`id: '${demo.meta.id}'`);
    }
  });
});
