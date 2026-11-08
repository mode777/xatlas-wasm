import { createCube } from '../geometry.js';
import { addMesh } from '../mesh.js';
import type { DemoDefinition, DemoInput } from '../types.js';

const mesh = createCube(1);

const demo: DemoDefinition = {
  meta: {
    id: 'cube',
    title: 'Cube',
    description:
      'Eight shared vertices and twelve triangles. Six planar charts make the atlas layout easy to read.',
    features: ['planar', 'charts', 'atlas-image'],
    input: 'generated',
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
