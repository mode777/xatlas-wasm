import { gazeboObj } from '../assets/gazebo.js';
import { milkTruckGeometry } from '../assets/milk-truck.js';
import { addMeshes } from '../mesh.js';
import { parseObjInput } from '../obj.js';
import { createTownLevel } from '../town.js';
import type { DemoDefinition, DemoInput } from '../types.js';

const gazebo = parseObjInput(gazeboObj);
const milkTruck: DemoInput = {
  kind: 'mesh',
  positions: milkTruckGeometry.positions,
  indices: milkTruckGeometry.indices,
};
const level = createTownLevel(gazebo, milkTruck);

const demo: DemoDefinition = {
  meta: {
    id: 'town-level',
    title: 'Town level',
    description:
      'A multi-model town square: gazebo, milk truck, buildings, roads and props added as separate xatlas meshes. Shows chart growth and packing at level scale.',
    features: ['real-world', 'multi-model', 'charts', 'packing'],
    input: 'asset',
  },
  chartOptions: {
    maxCost: 1.5,
  },
  packOptions: {
    createImage: true,
    resolution: 1024,
    padding: 2,
    bilinear: true,
  },
  build(context): readonly DemoInput[] {
    return addMeshes(context, level);
  },
};

export default demo;
