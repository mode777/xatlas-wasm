import { createTerrain } from '../geometry.js';
import { addMesh } from '../mesh.js';
import type { DemoDefinition, DemoInput } from '../types.js';

const mesh = createTerrain(5, 32, 0.5);

const demo: DemoDefinition = {
  meta: {
    id: 'terrain',
    title: 'Terrain',
    description:
      'A connected heightfield with gentle curvature. Chart cost and iteration count decide where the surface is cut.',
    features: ['maxCost', 'maxIterations', 'charts'],
    input: 'generated',
  },
  chartOptions: {
    maxCost: 1.25,
    maxIterations: 2,
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
