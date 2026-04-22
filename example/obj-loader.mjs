/**
 * Minimal OBJ file parser.
 *
 * Supports:  v, vt, vn, f (triangles & quads, all index variants)
 * Returns flat typed arrays matching the xatlas MeshDeclOptions shape.
 */

/**
 * Parse an OBJ file string into de-duplicated vertex arrays + index buffer.
 *
 * @param {string} text  Raw OBJ file content.
 * @returns {{ positions: Float32Array, normals: Float32Array | null, uvs: Float32Array | null, indices: Uint32Array }}
 */
export function parseOBJ(text) {
  // Raw (1-indexed) pools
  const rawPos = [];   // flat xyz
  const rawUV = [];    // flat xy
  const rawNorm = [];  // flat xyz

  // De-duplicated output
  const outPos = [];
  const outUV = [];
  const outNorm = [];
  const outIdx = [];

  let hasUV = false;
  let hasNorm = false;

  // Map "pi/ti/ni" → output vertex index for dedup
  const vertexMap = new Map();

  function addVertex(key, pi, ti, ni) {
    let idx = vertexMap.get(key);
    if (idx !== undefined) return idx;

    idx = outPos.length / 3;
    vertexMap.set(key, idx);

    outPos.push(rawPos[pi * 3], rawPos[pi * 3 + 1], rawPos[pi * 3 + 2]);

    if (hasUV && ti >= 0) {
      outUV.push(rawUV[ti * 2], rawUV[ti * 2 + 1]);
    } else if (hasUV) {
      outUV.push(0, 0);
    }

    if (hasNorm && ni >= 0) {
      outNorm.push(rawNorm[ni * 3], rawNorm[ni * 3 + 1], rawNorm[ni * 3 + 2]);
    } else if (hasNorm) {
      outNorm.push(0, 0, 0);
    }

    return idx;
  }

  // First pass: determine which attributes exist
  const lines = text.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('vt ')) { hasUV = true; }
    else if (line.startsWith('vn ')) { hasNorm = true; }
  }

  // Second pass: parse
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0 || line[0] === '#') continue;

    const parts = line.split(/\s+/);
    const cmd = parts[0];

    if (cmd === 'v') {
      rawPos.push(+parts[1], +parts[2], +parts[3]);
    } else if (cmd === 'vt') {
      rawUV.push(+parts[1], +parts[2] || 0);
    } else if (cmd === 'vn') {
      rawNorm.push(+parts[1], +parts[2], +parts[3]);
    } else if (cmd === 'f') {
      const verts = [];
      for (let i = 1; i < parts.length; i++) {
        const seg = parts[i];
        const ids = seg.split('/');
        const pi = parseInt(ids[0], 10) - 1;
        const ti = ids.length > 1 && ids[1] !== '' ? parseInt(ids[1], 10) - 1 : -1;
        const ni = ids.length > 2 && ids[2] !== '' ? parseInt(ids[2], 10) - 1 : -1;
        const key = `${pi}/${ti}/${ni}`;
        verts.push(addVertex(key, pi, ti, ni));
      }
      // Fan-triangulate (works for tris, quads, and n-gons)
      for (let i = 1; i < verts.length - 1; i++) {
        outIdx.push(verts[0], verts[i], verts[i + 1]);
      }
    }
  }

  return {
    positions: new Float32Array(outPos),
    normals: hasNorm ? new Float32Array(outNorm) : null,
    uvs: hasUV ? new Float32Array(outUV) : null,
    indices: new Uint32Array(outIdx),
  };
}
