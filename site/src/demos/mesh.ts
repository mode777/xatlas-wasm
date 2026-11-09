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

/** Add every mesh of a multi-model scenario in order. */
export function addMeshes(
  context: DemoContext,
  inputs: readonly DemoInput[],
): readonly DemoInput[] {
  if (inputs.length === 0) {
    throw new Error('a scenario must add at least one mesh');
  }
  for (const input of inputs) addMesh(context, input);
  return inputs;
}
