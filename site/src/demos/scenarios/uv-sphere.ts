import { createUvSphere } from '../geometry.js';
import { addMesh } from '../mesh.js';
import type { DemoDefinition, DemoInput } from '../types.js';

const mesh = createUvSphere(1, 32, 16);

const demo: DemoDefinition = {
  meta: {
    id: 'uv-sphere',
    title: 'UV sphere',
    description:
      'A smooth closed surface with a longitude seam. Shows how normals and winding affect chart boundaries.',
    features: ['seam', 'fixWinding', 'normals'],
    input: 'generated',
  },
  chartOptions: {
    fixWinding: true,
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
