import { milkTruckGeometry } from '../assets/milk-truck.js';
import { addMesh } from '../mesh.js';
import type { DemoDefinition, DemoInput } from '../types.js';

const mesh: DemoInput = {
  kind: 'mesh',
  positions: milkTruckGeometry.positions,
  indices: milkTruckGeometry.indices,
};

const demo: DemoDefinition = {
  meta: {
    id: 'milk-truck',
    title: 'Cesium Milk Truck',
    description:
      'A production hard-surface vehicle with body panels, windows and two wheel sets. Shows seams and chart growth on a real asset.',
    features: ['real-world', 'hard-surface', 'charts', 'padding'],
    input: 'asset',
  },
  packOptions: {
    createImage: true,
    padding: 2,
    bilinear: true,
  },
  build(context): DemoInput {
    return addMesh(context, mesh);
  },
};

export default demo;
