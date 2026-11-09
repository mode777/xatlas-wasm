import type { DemoInput } from './types.js';

export interface MeshTransform {
  readonly x?: number;
  readonly y?: number;
  readonly z?: number;
  readonly rotateY?: number;
  readonly scale?: number;
}

interface MeshBounds {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
}

function requirePositions(input: DemoInput): Float32Array {
  if (input.kind !== 'mesh' || !input.positions) {
    throw new Error('town geometry requires positions');
  }
  return input.positions;
}

/** Clone a mesh and apply a uniform scale, Y rotation and translation. */
export function transformMesh(
  input: DemoInput,
  transform: MeshTransform = {},
): DemoInput {
  const source = requirePositions(input);
  const scale = transform.scale ?? 1;
  if (!(scale > 0)) throw new Error('mesh scale must be positive');
  const angle = transform.rotateY ?? 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const tx = transform.x ?? 0;
  const ty = transform.y ?? 0;
  const tz = transform.z ?? 0;
  const positions = new Float32Array(source.length);

  for (let i = 0; i < source.length; i += 3) {
    const x = source[i]! * scale;
    const y = source[i + 1]! * scale;
    const z = source[i + 2]! * scale;
    positions[i] = x * cos + z * sin + tx;
    positions[i + 1] = y + ty;
    positions[i + 2] = -x * sin + z * cos + tz;
  }

  return {
    kind: 'mesh',
    positions,
    indices: new Uint32Array(input.indices),
  };
}

/** Merge several meshes into one indexed mesh, preserving winding. */
export function mergeMeshes(inputs: readonly DemoInput[]): DemoInput {
  if (inputs.length === 0) throw new Error('cannot merge zero meshes');
  let vertexCount = 0;
  let indexCount = 0;
  for (const input of inputs) {
    vertexCount += requirePositions(input).length / 3;
    indexCount += input.indices.length;
  }

  const positions = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(indexCount);
  let vertexOffset = 0;
  let indexOffset = 0;
  for (const input of inputs) {
    const source = requirePositions(input);
    positions.set(source, vertexOffset * 3);
    for (let i = 0; i < input.indices.length; i++) {
      indices[indexOffset + i] = input.indices[i]! + vertexOffset;
    }
    vertexOffset += source.length / 3;
    indexOffset += input.indices.length;
  }

  return { kind: 'mesh', positions, indices };
}

function boundsOf(input: DemoInput): MeshBounds {
  const positions = requirePositions(input);
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]!);
    minY = Math.min(minY, positions[i + 1]!);
    maxX = Math.max(maxX, positions[i]!);
    maxY = Math.max(maxY, positions[i + 1]!);
    minZ = Math.min(minZ, positions[i + 2]!);
    maxZ = Math.max(maxZ, positions[i + 2]!);
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

/** Center an asset on the origin, put its base on y=0, then place it. */
function placeAsset(
  input: DemoInput,
  options: {
    readonly scale: number;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly rotateY?: number;
  },
): DemoInput {
  const bounds = boundsOf(input);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const centered = transformMesh(input, {
    x: -centerX,
    y: -bounds.minY,
    z: -centerZ,
  });
  return transformMesh(centered, options);
}

function createBox(
  width: number,
  height: number,
  depth: number,
): DemoInput {
  const w = width / 2;
  const d = depth / 2;
  const positions = new Float32Array([
    -w, 0, -d,
    w, 0, -d,
    w, height, -d,
    -w, height, -d,
    -w, 0, d,
    w, 0, d,
    w, height, d,
    -w, height, d,
  ]);
  const indices = new Uint32Array([
    4, 5, 6, 4, 6, 7,
    1, 0, 3, 1, 3, 2,
    0, 4, 7, 0, 7, 3,
    5, 1, 2, 5, 2, 6,
    0, 1, 5, 0, 5, 4,
    3, 7, 6, 3, 6, 2,
  ]);
  return { kind: 'mesh', positions, indices };
}

function createPyramid(
  width: number,
  depth: number,
  height: number,
): DemoInput {
  const w = width / 2;
  const d = depth / 2;
  const positions = new Float32Array([
    -w, 0, -d,
    w, 0, -d,
    w, 0, d,
    -w, 0, d,
    0, height, 0,
  ]);
  const indices = new Uint32Array([
    3, 2, 4,
    2, 1, 4,
    1, 0, 4,
    0, 3, 4,
    0, 1, 2, 0, 2, 3,
  ]);
  return { kind: 'mesh', positions, indices };
}

function createBuildings(): DemoInput[] {
  const specs = [
    { x: -14, z: -13, w: 6, d: 5, h: 6, roof: 2.2 },
    { x: 0, z: -15, w: 8, d: 5, h: 7, roof: 2.5 },
    { x: 14, z: -13, w: 6, d: 5, h: 5, roof: 2 },
    { x: -14, z: 13, w: 5, d: 5, h: 5, roof: 2 },
    { x: 0, z: 15, w: 7, d: 5, h: 6, roof: 2.3 },
    { x: 14, z: 13, w: 6, d: 5, h: 4.5, roof: 1.9 },
    { x: -17, z: 0, w: 4, d: 7, h: 5, roof: 2 },
    { x: 17, z: 0, w: 4, d: 7, h: 6, roof: 2.4 },
  ];

  const meshes: DemoInput[] = [];
  for (const spec of specs) {
    meshes.push(
      transformMesh(createBox(spec.w, spec.h, spec.d), {
        x: spec.x,
        z: spec.z,
      }),
      transformMesh(createPyramid(spec.w + 0.6, spec.d + 0.6, spec.roof), {
        x: spec.x,
        y: spec.h,
        z: spec.z,
      }),
      transformMesh(createBox(spec.w + 0.3, 0.28, spec.d + 0.3), {
        x: spec.x,
        y: spec.h * 0.55,
        z: spec.z,
      }),
    );

    const door = createBox(1.2, 2, 0.18);
    const onXAxis = Math.abs(spec.x) > Math.abs(spec.z);
    const doorTransform = onXAxis
      ? {
          x: spec.x + Math.sign(spec.x) * (spec.w / 2 + 0.09),
          y: 0.1,
          z: spec.z,
          rotateY: Math.PI / 2,
        }
      : {
          x: spec.x,
          y: 0.1,
          z: spec.z + Math.sign(spec.z) * (spec.d / 2 + 0.09),
          rotateY: 0,
        };
    meshes.push(transformMesh(door, doorTransform));
  }
  return meshes;
}

function createProps(): DemoInput[] {
  const meshes: DemoInput[] = [];

  for (const [x, z] of [
    [-5.5, -5.5],
    [5.5, -5.5],
    [-5.5, 5.5],
    [5.5, 5.5],
  ] as const) {
    meshes.push(
      transformMesh(createBox(0.18, 3.4, 0.18), { x, y: 0.1, z }),
      transformMesh(createBox(0.55, 0.45, 0.55), { x, y: 3.5, z }),
    );
  }

  const bench = mergeMeshes([
    transformMesh(createBox(2.2, 0.2, 0.7), { y: 0.5 }),
    transformMesh(createBox(2.2, 0.75, 0.15), { y: 0.65, z: -0.28 }),
    transformMesh(createBox(0.15, 0.5, 0.6), { x: -0.9 }),
    transformMesh(createBox(0.15, 0.5, 0.6), { x: 0.9 }),
  ]);
  for (const [x, z, rotateY] of [
    [-4.5, -3.5, 0],
    [4.5, 3.5, Math.PI],
    [-3.5, 4.5, Math.PI / 2],
    [3.5, -4.5, -Math.PI / 2],
  ] as const) {
    meshes.push(transformMesh(bench, { x, y: 0.1, z, rotateY }));
  }

  const planter = mergeMeshes([
    transformMesh(createBox(1.6, 0.8, 1.6), { y: 0 }),
    transformMesh(createBox(0.22, 1.4, 0.22), { y: 0.8 }),
    transformMesh(createPyramid(1.4, 1.4, 1.6), { y: 2.2 }),
  ]);
  for (const [x, z] of [
    [-6.5, 0],
    [6.5, 0],
    [0, -6.5],
    [0, 6.5],
  ] as const) {
    meshes.push(transformMesh(planter, { x, y: 0.1, z }));
  }

  for (const [x, z, size] of [
    [6.5, -3, 1.2],
    [7.8, -3, 1.0],
    [7, -1.8, 0.9],
  ] as const) {
    meshes.push(transformMesh(createBox(size, size, size), { x, y: 0.1, z }));
  }

  return meshes;
}

/**
 * Build the multi-model town square. The returned meshes are independent
 * xatlas inputs: ground, roads, plaza, buildings, props, gazebo and truck.
 */
export function createTownLevel(
  gazebo: DemoInput,
  milkTruck: DemoInput,
): readonly DemoInput[] {
  const ground = transformMesh(createBox(40, 0.2, 40), { y: -0.2 });
  const roads = mergeMeshes([
    transformMesh(createBox(38, 0.04, 4), { y: 0.01, z: -9 }),
    transformMesh(createBox(38, 0.04, 4), { y: 0.01, z: 9 }),
    transformMesh(createBox(4, 0.04, 38), { y: 0.01, x: -9 }),
    transformMesh(createBox(4, 0.04, 38), { y: 0.01, x: 9 }),
  ]);
  const sidewalks = mergeMeshes([
    transformMesh(createBox(16, 0.12, 1), { y: 0.02, z: -7.5 }),
    transformMesh(createBox(16, 0.12, 1), { y: 0.02, z: 7.5 }),
    transformMesh(createBox(1, 0.12, 16), { y: 0.02, x: -7.5 }),
    transformMesh(createBox(1, 0.12, 16), { y: 0.02, x: 7.5 }),
  ]);
  const plaza = mergeMeshes([
    transformMesh(createBox(14, 0.1, 14), { y: 0.02 }),
    sidewalks,
  ]);
  const buildings = mergeMeshes(createBuildings());
  const props = mergeMeshes(createProps());
  const gazeboMesh = placeAsset(gazebo, {
    scale: 1.2,
    x: 0,
    y: 0.12,
    z: 0,
  });
  const truckMesh = placeAsset(milkTruck, {
    scale: 1.4,
    x: 9,
    y: 0.05,
    z: 2.5,
    rotateY: 0,
  });

  return [ground, roads, plaza, buildings, props, gazeboMesh, truckMesh];
}
