import type { DemoInput } from './types.js';

export interface ParsedObj {
  readonly positions: Float32Array;
  readonly normals?: Float32Array;
  readonly uvs?: Float32Array;
  readonly indices: Uint32Array;
}

/**
 * Minimal OBJ parser for the showcase's embedded asset. Supports `v`, `vt`,
 * `vn` and `f` (triangles and n-gons, positive or negative indices) and
 * de-duplicates the per-corner indices into one vertex buffer.
 */
export function parseObj(text: string): ParsedObj {
  const lines = text.split(/\r?\n/);
  const rawPositions: number[] = [];
  const rawUvs: number[] = [];
  const rawNormals: number[] = [];

  let hasUvs = false;
  let hasNormals = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('vt ')) hasUvs = true;
    else if (line.startsWith('vn ')) hasNormals = true;
  }

  const outPositions: number[] = [];
  const outUvs: number[] = [];
  const outNormals: number[] = [];
  const outIndices: number[] = [];
  const vertexMap = new Map<string, number>();

  const resolveIndex = (value: number, length: number): number =>
    value < 0 ? length + value : value - 1;

  const addVertex = (
    key: string,
    positionIndex: number,
    uvIndex: number,
    normalIndex: number,
  ): number => {
    const existing = vertexMap.get(key);
    if (existing !== undefined) return existing;

    const index = outPositions.length / 3;
    vertexMap.set(key, index);
    outPositions.push(
      rawPositions[positionIndex * 3]!,
      rawPositions[positionIndex * 3 + 1]!,
      rawPositions[positionIndex * 3 + 2]!,
    );

    if (hasUvs) {
      if (uvIndex >= 0) {
        outUvs.push(rawUvs[uvIndex * 2]!, rawUvs[uvIndex * 2 + 1]!);
      } else {
        outUvs.push(0, 0);
      }
    }
    if (hasNormals) {
      if (normalIndex >= 0) {
        outNormals.push(
          rawNormals[normalIndex * 3]!,
          rawNormals[normalIndex * 3 + 1]!,
          rawNormals[normalIndex * 3 + 2]!,
        );
      } else {
        outNormals.push(0, 0, 0);
      }
    }
    return index;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const command = parts[0];

    if (command === 'v') {
      rawPositions.push(Number(parts[1]), Number(parts[2]), Number(parts[3]));
    } else if (command === 'vt') {
      rawUvs.push(Number(parts[1]), Number(parts[2] ?? 0));
    } else if (command === 'vn') {
      rawNormals.push(Number(parts[1]), Number(parts[2]), Number(parts[3]));
    } else if (command === 'f') {
      const corners: number[] = [];
      for (let i = 1; i < parts.length; i++) {
        const segments = parts[i]!.split('/');
        const positionIndex = resolveIndex(
          Number(segments[0]),
          rawPositions.length / 3,
        );
        const uvIndex =
          segments[1] !== undefined && segments[1] !== ''
            ? resolveIndex(Number(segments[1]), rawUvs.length / 2)
            : -1;
        const normalIndex =
          segments[2] !== undefined && segments[2] !== ''
            ? resolveIndex(Number(segments[2]), rawNormals.length / 3)
            : -1;
        corners.push(
          addVertex(
            `${positionIndex}/${uvIndex}/${normalIndex}`,
            positionIndex,
            uvIndex,
            normalIndex,
          ),
        );
      }
      for (let i = 1; i < corners.length - 1; i++) {
        outIndices.push(corners[0]!, corners[i]!, corners[i + 1]!);
      }
    }
  }

  const result: {
    positions: Float32Array;
    indices: Uint32Array;
    normals?: Float32Array;
    uvs?: Float32Array;
  } = {
    positions: new Float32Array(outPositions),
    indices: new Uint32Array(outIndices),
  };
  if (hasUvs) result.uvs = new Float32Array(outUvs);
  if (hasNormals) result.normals = new Float32Array(outNormals);
  return result;
}

/** Convert a parsed OBJ into the scenario input shape. */
export function parseObjInput(text: string): DemoInput {
  const parsed = parseObj(text);
  return {
    kind: 'mesh',
    positions: parsed.positions,
    indices: parsed.indices,
    ...(parsed.normals ? { normals: parsed.normals } : {}),
    ...(parsed.uvs ? { uvs: parsed.uvs } : {}),
  };
}
