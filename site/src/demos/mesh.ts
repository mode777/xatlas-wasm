import type { DemoContext, DemoInput } from './types.js';

/** Add a mesh scenario's input through the worker's checked context helper. */
export function addMesh(context: DemoContext, input: DemoInput): DemoInput {
  if (input.kind !== 'mesh' || !input.positions) {
    throw new Error('this scenario requires positions');
  }
  context.addMesh({
    positions: input.positions,
    indices: input.indices,
    ...(input.normals ? { normals: input.normals } : {}),
    ...(input.uvs ? { uvs: input.uvs } : {}),
  });
  return input;
}
