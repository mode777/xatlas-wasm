import { describe, expect, it } from 'vitest';
import { milkTruckGeometry } from '../src/demos/assets/milk-truck.js';

describe('embedded Milk Truck asset', () => {
  it('contains the expected indexed triangle geometry', () => {
    expect(milkTruckGeometry.vertexCount).toBe(4823);
    expect(milkTruckGeometry.triangleCount).toBe(3624);
    expect(milkTruckGeometry.positions.length).toBe(
      milkTruckGeometry.vertexCount * 3,
    );
    expect(milkTruckGeometry.indices.length).toBe(
      milkTruckGeometry.triangleCount * 3,
    );
    expect(milkTruckGeometry.positions.length).toBeGreaterThan(0);
    expect(milkTruckGeometry.indices.length).toBeGreaterThan(0);
  });

  it('contains finite positions and in-range indices', () => {
    for (const value of milkTruckGeometry.positions) {
      expect(Number.isFinite(value)).toBe(true);
    }
    for (const index of milkTruckGeometry.indices) {
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(milkTruckGeometry.vertexCount);
    }
  });

  it('spans a non-degenerate bounding box', () => {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < milkTruckGeometry.positions.length; i += 3) {
      for (let axis = 0; axis < 3; axis++) {
        const value = milkTruckGeometry.positions[i + axis]!;
        min[axis] = Math.min(min[axis]!, value);
        max[axis] = Math.max(max[axis]!, value);
      }
    }
    for (let axis = 0; axis < 3; axis++) {
      expect(max[axis]! - min[axis]!).toBeGreaterThan(0.1);
    }
  });

  it('records complete source provenance', () => {
    expect(milkTruckGeometry.source.url).toContain(
      'KhronosGroup/glTF-Sample-Assets',
    );
    expect(milkTruckGeometry.source.commit).toBe(
      '8f492390ddc7a2ae221a1369ef560589cf8c70fb',
    );
    expect(milkTruckGeometry.source.license).toBe('CC BY 4.0');
    expect(milkTruckGeometry.source.copyright).toContain('Cesium');
    expect(milkTruckGeometry.source.file).toBe('CesiumMilkTruck.glb');
    expect(milkTruckGeometry.source.sha256).toBe(
      '09371b34608116de5842d23abe260bf11acf3e1554daf334a647eb566eee5c49',
    );
  });
});
