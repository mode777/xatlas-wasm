import { describe, expect, it } from 'vitest';
import { gazeboObj } from '../src/demos/assets/gazebo.js';
import { parseObj, parseObjInput } from '../src/demos/obj.js';

describe('OBJ parsing', () => {
  it('parses the embedded gazebo with positions, normals and faces', () => {
    const parsed = parseObj(gazeboObj);
    expect(parsed.positions.length).toBeGreaterThan(0);
    expect(parsed.indices.length).toBeGreaterThan(0);
    expect(parsed.normals).toBeDefined();
    expect(parsed.normals!.length).toBe(parsed.positions.length);
    expect(parsed.indices.length % 3).toBe(0);

    const vertexCount = parsed.positions.length / 3;
    for (const index of parsed.indices) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(vertexCount);
    }
  });

  it('returns the scenario input shape', () => {
    const input = parseObjInput(gazeboObj);
    expect(input.kind).toBe('mesh');
    expect(input.positions!.length).toBeGreaterThan(0);
    expect(input.indices.length).toBeGreaterThan(0);
    expect(input.normals).toBeDefined();
  });
});
