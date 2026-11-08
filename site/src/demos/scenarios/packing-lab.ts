import { createPackingPanels } from '../geometry.js';
import { addMesh } from '../mesh.js';
import type { DemoDefinition, DemoInput } from '../types.js';

const mesh = createPackingPanels(36);

const demo: DemoDefinition = {
  meta: {
    id: 'packing-lab',
    title: 'Packing lab',
    description:
      'Thirty-six disconnected panels. Padding, bilinear safety and packing strategies dominate the atlas.',
    features: ['padding', 'bilinear', 'blockAlign', 'bruteForce'],
    input: 'generated',
  },
  packOptions: {
    createImage: true,
    padding: 8,
    bilinear: true,
    blockAlign: true,
    bruteForce: true,
  },
  build(context): DemoInput {
    return addMesh(context, mesh);
  },
};

export default demo;
