import { createDenseGrid } from '../geometry.js';
import { addMesh } from '../mesh.js';
import type { DemoDefinition, DemoInput } from '../types.js';

const mesh = createDenseGrid(6, 48, 0.45);

const demo: DemoDefinition = {
  meta: {
    id: 'multi-atlas',
    title: 'Multi-atlas',
    description:
      'A dense wavy grid packed into a fixed resolution. Charts that do not fit spill into additional sub-atlases.',
    features: ['resolution', 'multi-atlas', 'utilization'],
    input: 'generated',
  },
  chartOptions: {
    maxChartArea: 0.2,
    maxBoundaryLength: 2,
  },
  packOptions: {
    createImage: true,
    resolution: 128,
    texelsPerUnit: 8,
    padding: 2,
    bilinear: true,
  },
  build(context): DemoInput {
    return addMesh(context, mesh);
  },
};

export default demo;
