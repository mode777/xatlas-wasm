#!/usr/bin/env node
/**
 * Extract indexed triangle geometry from a local GLB and write a committed
 * TypeScript asset module. This is an authoring-time tool: the generated module
 * is what the site and the Node tests import, so neither fetches a model.
 *
 * Usage:
 *   node site/scripts/embed-glb.mjs <input.glb> <output.ts> [options]
 *
 * Options:
 *   --export-name <name>   Exported const name (default: milkTruckGeometry)
 *   --source-url <url>     Model URL recorded in the metadata
 *   --commit <sha>         Upstream revision recorded in the metadata
 *   --license <text>       License recorded in the metadata
 *   --copyright <text>     Copyright recorded in the metadata
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const TRIANGLES = 4;

const COMPONENTS = {
  5120: { size: 1, read: (view, offset) => view.getInt8(offset) },
  5121: { size: 1, read: (view, offset) => view.getUint8(offset) },
  5122: { size: 2, read: (view, offset) => view.getInt16(offset, true) },
  5123: { size: 2, read: (view, offset) => view.getUint16(offset, true) },
  5125: { size: 4, read: (view, offset) => view.getUint32(offset, true) },
  5126: { size: 4, read: (view, offset) => view.getFloat32(offset, true) },
};

const COMPONENT_COUNTS = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

function usage(message) {
  if (message) console.error(message);
  console.error(
    'Usage: node site/scripts/embed-glb.mjs <input.glb> <output.ts> ' +
      '[--export-name milkTruckGeometry] [--source-url url] ' +
      '[--commit sha] [--license text] [--copyright text]',
  );
  process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  const options = new Map();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const value = argv[++i];
    if (value === undefined || value.startsWith('--')) {
      usage(`Missing value for --${key}`);
    }
    options.set(key, value);
  }
  return { positional, options };
}

function parseGlb(buffer) {
  if (buffer.length < 12) throw new Error('GLB is shorter than its header');
  const magic = buffer.readUInt32LE(0);
  const version = buffer.readUInt32LE(4);
  const length = buffer.readUInt32LE(8);
  if (magic !== GLB_MAGIC) throw new Error('not a GLB file (bad magic)');
  if (version !== 2) throw new Error(`unsupported GLB version ${version}`);
  if (length !== buffer.length) {
    throw new Error(`GLB length ${length} does not match file length ${buffer.length}`);
  }

  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) throw new Error('truncated GLB chunk header');
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;
    if (offset + chunkLength > buffer.length) throw new Error('truncated GLB chunk');
    const chunk = buffer.subarray(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === CHUNK_JSON) {
      json = JSON.parse(chunk.toString('utf8').replace(/\0+$/, ''));
    } else if (chunkType === CHUNK_BIN) {
      bin = chunk;
    }
  }

  if (!json) throw new Error('GLB has no JSON chunk');
  if (!bin) throw new Error('GLB has no BIN chunk');
  return { json, bin };
}

function identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row] * b[column * 4 + k];
      }
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

function fromTrs(translation = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [1, 1, 1]) {
  const [x, y, z, w] = rotation;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  return [
    (1 - (yy + zz)) * scale[0],
    (xy + wz) * scale[0],
    (xz - wy) * scale[0],
    0,
    (xy - wz) * scale[1],
    (1 - (xx + zz)) * scale[1],
    (yz + wx) * scale[1],
    0,
    (xz + wy) * scale[2],
    (yz - wx) * scale[2],
    (1 - (xx + yy)) * scale[2],
    0,
    translation[0],
    translation[1],
    translation[2],
    1,
  ];
}

function localMatrix(node) {
  if (Array.isArray(node.matrix)) {
    if (node.matrix.length !== 16) throw new Error('node matrix must have 16 values');
    return node.matrix.slice();
  }
  return fromTrs(node.translation, node.rotation, node.scale);
}

function applyMatrix(matrix, x, y, z) {
  const outX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
  const outY = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
  const outZ = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
  const outW = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  if (outW !== 0 && outW !== 1) {
    return [outX / outW, outY / outW, outZ / outW];
  }
  return [outX, outY, outZ];
}

function readAccessor(json, bin, accessorIndex) {
  const accessor = json.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`missing accessor ${accessorIndex}`);
  if (accessor.sparse) throw new Error('sparse accessors are not supported');
  if (accessor.bufferView === undefined) {
    throw new Error(`accessor ${accessorIndex} has no bufferView`);
  }
  const view = json.bufferViews?.[accessor.bufferView];
  if (!view) throw new Error(`missing bufferView ${accessor.bufferView}`);
  if (view.buffer !== 0) throw new Error('only the GLB BIN buffer is supported');

  const component = COMPONENTS[accessor.componentType];
  if (!component) throw new Error(`unsupported component type ${accessor.componentType}`);
  const componentCount = COMPONENT_COUNTS[accessor.type];
  if (!componentCount) throw new Error(`unsupported accessor type ${accessor.type}`);

  const elementSize = component.size * componentCount;
  const stride = view.byteStride ?? elementSize;
  const viewStart = view.byteOffset ?? 0;
  const dataView = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const values = new Float64Array(accessor.count * componentCount);

  for (let i = 0; i < accessor.count; i++) {
    const elementOffset =
      viewStart + (accessor.byteOffset ?? 0) + i * stride;
    for (let c = 0; c < componentCount; c++) {
      values[i * componentCount + c] = component.read(
        dataView,
        elementOffset + c * component.size,
      );
    }
  }
  return { accessor, values, componentCount };
}

function extractGeometry(glbPath) {
  const buffer = readFileSync(glbPath);
  const { json, bin } = parseGlb(buffer);
  const sceneIndex = json.scene ?? 0;
  const scene = json.scenes?.[sceneIndex];
  if (!scene) throw new Error(`missing scene ${sceneIndex}`);

  const positions = [];
  const indices = [];
  let primitiveCount = 0;

  function visit(nodeIndex, parentMatrix) {
    const node = json.nodes?.[nodeIndex];
    if (!node) throw new Error(`missing node ${nodeIndex}`);
    const world = multiply(parentMatrix, localMatrix(node));

    if (node.mesh !== undefined) {
      const mesh = json.meshes?.[node.mesh];
      if (!mesh) throw new Error(`missing mesh ${node.mesh}`);
      for (const primitive of mesh.primitives ?? []) {
        const mode = primitive.mode ?? TRIANGLES;
        if (mode !== TRIANGLES) continue;
        if (primitive.attributes?.POSITION === undefined) continue;

        const positionData = readAccessor(json, bin, primitive.attributes.POSITION);
        if (positionData.accessor.type !== 'VEC3') {
          throw new Error('POSITION accessor must be VEC3');
        }
        const baseVertex = positions.length / 3;

        for (let i = 0; i < positionData.accessor.count; i++) {
          const [x, y, z] = applyMatrix(
            world,
            positionData.values[i * 3],
            positionData.values[i * 3 + 1],
            positionData.values[i * 3 + 2],
          );
          positions.push(x, y, z);
        }

        if (primitive.indices !== undefined) {
          const indexData = readAccessor(json, bin, primitive.indices);
          if (indexData.accessor.type !== 'SCALAR') {
            throw new Error('index accessor must be SCALAR');
          }
          for (let i = 0; i < indexData.accessor.count; i++) {
            indices.push(baseVertex + indexData.values[i]);
          }
        } else {
          for (let i = 0; i < positionData.accessor.count; i++) {
            indices.push(baseVertex + i);
          }
        }
        primitiveCount++;
      }
    }

    for (const child of node.children ?? []) visit(child, world);
  }

  for (const nodeIndex of scene.nodes ?? []) visit(nodeIndex, identity());

  if (primitiveCount === 0) throw new Error('no triangle primitives found');
  if (positions.length === 0 || indices.length === 0) {
    throw new Error('extracted geometry is empty');
  }
  if (indices.length % 3 !== 0) {
    throw new Error(`index count ${indices.length} is not a multiple of three`);
  }

  const vertexCount = positions.length / 3;
  for (let i = 0; i < positions.length; i++) {
    if (!Number.isFinite(positions[i])) {
      throw new Error(`non-finite position at index ${i}`);
    }
  }
  for (let i = 0; i < indices.length; i++) {
    if (!Number.isInteger(indices[i]) || indices[i] < 0 || indices[i] >= vertexCount) {
      throw new Error(`index ${indices[i]} at ${i} is out of range`);
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    primitiveCount,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}

function formatNumbers(values, indent = '  ') {
  const lines = [];
  const perLine = 12;
  for (let i = 0; i < values.length; i += perLine) {
    lines.push(`${indent}${values.slice(i, i + perLine).join(', ')},`);
  }
  return lines.join('\n');
}

function formatPositions(values) {
  const lines = [];
  const perLine = 9;
  for (let i = 0; i < values.length; i += perLine) {
    const chunk = [];
    for (let j = i; j < Math.min(i + perLine, values.length); j++) {
      chunk.push(Number(values[j].toPrecision(9)));
    }
    lines.push(`  ${chunk.join(', ')},`);
  }
  return lines.join('\n');
}

function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  if (positional.length !== 2) {
    usage('Expected an input GLB path and an output TypeScript path');
  }
  const [inputPath, outputPath] = positional.map((path) => resolve(path));
  const exportName = options.get('export-name') ?? 'milkTruckGeometry';
  const sourceUrl =
    options.get('source-url') ??
    'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/8f492390ddc7a2ae221a1369ef560589cf8c70fb/Models/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb';
  const commit =
    options.get('commit') ?? '8f492390ddc7a2ae221a1369ef560589cf8c70fb';
  const license = options.get('license') ?? 'CC BY 4.0';
  const copyright = options.get('copyright') ?? 'Copyright (c) 2017 Cesium';

  const geometry = extractGeometry(inputPath);
  const vertexCount = geometry.positions.length / 3;
  const triangleCount = geometry.indices.length / 3;
  const sourceFile = basename(inputPath);

  const output = `// Generated by site/scripts/embed-glb.mjs. Do not edit by hand.
//
// Source: ${sourceUrl}
// Commit: ${commit}
// License: ${license}
// Copyright: ${copyright}
// Source file: ${sourceFile}
// Source SHA-256: ${geometry.sha256}
// Vertices: ${vertexCount}
// Triangles: ${triangleCount}

export interface EmbeddedGeometrySource {
  readonly url: string;
  readonly commit: string;
  readonly license: string;
  readonly copyright: string;
  readonly file: string;
  readonly sha256: string;
}

export interface EmbeddedGeometry {
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly source: EmbeddedGeometrySource;
}

export const ${exportName}: EmbeddedGeometry = {
  positions: new Float32Array([
${formatPositions(geometry.positions)}
  ]),
  indices: new Uint32Array([
${formatNumbers(geometry.indices)}
  ]),
  vertexCount: ${vertexCount},
  triangleCount: ${triangleCount},
  source: {
    url: ${JSON.stringify(sourceUrl)},
    commit: ${JSON.stringify(commit)},
    license: ${JSON.stringify(license)},
    copyright: ${JSON.stringify(copyright)},
    file: ${JSON.stringify(sourceFile)},
    sha256: ${JSON.stringify(geometry.sha256)},
  },
};
`;

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, output, 'utf8');
  console.log(
    `Wrote ${outputPath}: ${vertexCount} vertices, ${triangleCount} triangles, ` +
      `${geometry.primitiveCount} primitives, SHA-256 ${geometry.sha256}`,
  );
}

main();
