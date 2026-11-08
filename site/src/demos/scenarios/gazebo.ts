import { gazeboObj } from '../assets/gazebo.js';
import { addMesh } from '../mesh.js';
import { parseObjInput } from '../obj.js';
import type { DemoDefinition, DemoInput } from '../types.js';

const mesh = parseObjInput(gazeboObj);

const demo: DemoDefinition = {
  meta: {
    id: 'gazebo',
    title: 'Gazebo',
    description:
      'A real architectural model with hard edges, repeated details and no authored UVs. The baseline case for chart growth and packing.',
    features: ['real-world', 'LSCM', 'padding'],
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
