/**
 * xatlas-wasm — JavaScript wrapper for the xatlas UV atlas generation library.
 *
 * Usage:
 *   import createXAtlas from './xatlas.mjs';
 *   const xatlas = await createXAtlas();
 *   const atlas = xatlas.createAtlas();
 *   atlas.addMesh({ positions, indices });
 *   atlas.generate();
 *   const mesh = atlas.getMesh(0);
 *   atlas.destroy();
 */

/* ── Enums ───────────────────────────────────────────────────────── */

export const ChartType = Object.freeze({
  Planar: 0,
  Ortho: 1,
  LSCM: 2,
  Piecewise: 3,
  Invalid: 4,
});

export const IndexFormat = Object.freeze({
  UInt16: 0,
  UInt32: 1,
});

export const AddMeshError = Object.freeze({
  Success: 0,
  Error: 1,
  IndexOutOfRange: 2,
  InvalidFaceVertexCount: 3,
  InvalidIndexCount: 4,
});

export const ProgressCategory = Object.freeze({
  AddMesh: 0,
  ComputeCharts: 1,
  PackCharts: 2,
  BuildOutputMeshes: 3,
});

/* ── Helpers ─────────────────────────────────────────────────────── */

function copyToHeap(module, typedArray, heapType) {
  const numBytes = typedArray.byteLength;
  const ptr = module._malloc(numBytes);
  if (!ptr) throw new Error('xatlas-wasm: malloc failed');
  const dst = new Uint8Array(module.HEAPU8.buffer, ptr, numBytes);
  dst.set(new Uint8Array(typedArray.buffer, typedArray.byteOffset, numBytes));
  return ptr;
}

/* ── XAtlas class ────────────────────────────────────────────────── */

class XAtlas {
  /** @internal */
  constructor(module) {
    this._m = module;
    this._ptr = module._xatlasCreate();
    this._progressFnPtr = 0;
    if (!this._ptr) throw new Error('xatlas-wasm: xatlasCreate returned null');
  }

  destroy() {
    if (this._progressFnPtr) {
      this._m.removeFunction(this._progressFnPtr);
      this._progressFnPtr = 0;
    }
    if (this._ptr) {
      this._m._xatlasDestroy(this._ptr);
      this._ptr = 0;
    }
  }

  /**
   * Add a triangle mesh to the atlas.
   * @param {object} opts
   * @param {Float32Array} opts.positions  - Vertex positions (flat xyz, length = vertexCount * 3).
   * @param {Float32Array} [opts.normals]  - Vertex normals (flat xyz).
   * @param {Float32Array} [opts.uvs]      - Vertex UVs (flat xy).
   * @param {Uint16Array|Uint32Array} [opts.indices] - Triangle indices.
   * @param {Uint32Array} [opts.faceMaterialData] - Per-face material IDs.
   * @param {number} [opts.meshCountHint=0]
   * @returns {number} AddMeshError code.
   */
  addMesh(opts) {
    const m = this._m;
    const {
      positions,
      normals = null,
      uvs = null,
      indices = null,
      faceMaterialData = null,
      meshCountHint = 0,
    } = opts;

    const vertexCount = (positions.length / 3) | 0;

    // Allocate and zero the MeshDecl struct
    const declSize = m._xatlasMeshDecl_size();
    const declPtr = m._malloc(declSize);
    m.HEAPU8.fill(0, declPtr, declPtr + declSize);

    // Initialize with defaults
    m._xatlasMeshDeclInit(declPtr);

    // Allocations to free later
    const allocs = [declPtr];

    // positions (required)
    const posPtr = copyToHeap(m, positions);
    allocs.push(posPtr);

    // normals (optional)
    let normPtr = 0;
    if (normals) {
      normPtr = copyToHeap(m, normals);
      allocs.push(normPtr);
    }

    // uvs (optional)
    let uvPtr = 0;
    if (uvs) {
      uvPtr = copyToHeap(m, uvs);
      allocs.push(uvPtr);
    }

    // indices (optional)
    let idxPtr = 0;
    let indexCount = 0;
    let indexFormat = IndexFormat.UInt16;
    if (indices) {
      idxPtr = copyToHeap(m, indices);
      allocs.push(idxPtr);
      indexCount = indices.length;
      indexFormat = indices instanceof Uint32Array ? IndexFormat.UInt32 : IndexFormat.UInt16;
    }

    // faceMaterialData (optional)
    let faceMatPtr = 0;
    if (faceMaterialData) {
      faceMatPtr = copyToHeap(m, faceMaterialData);
      allocs.push(faceMatPtr);
    }

    // Write MeshDecl fields using Emscripten memory views.
    // Struct layout: use setValue with pointer offsets.
    // MeshDecl struct layout (all pointers are 4 bytes in wasm32):
    //   0:  vertexPositionData  (ptr)
    //   4:  vertexNormalData    (ptr)
    //   8:  vertexUvData        (ptr)
    //  12:  indexData            (ptr)
    //  16:  faceIgnoreData       (ptr)
    //  20:  faceMaterialData     (ptr)
    //  24:  faceVertexCount      (ptr)
    //  28:  vertexCount          (u32)
    //  32:  vertexPositionStride (u32)
    //  36:  vertexNormalStride   (u32)
    //  40:  vertexUvStride       (u32)
    //  44:  indexCount           (u32)
    //  48:  indexOffset           (i32)
    //  52:  faceCount            (u32)
    //  56:  indexFormat           (i32 enum)
    //  60:  epsilon              (f32)
    m.setValue(declPtr + 0, posPtr, 'i32');
    m.setValue(declPtr + 4, normPtr, 'i32');
    m.setValue(declPtr + 8, uvPtr, 'i32');
    m.setValue(declPtr + 12, idxPtr, 'i32');
    m.setValue(declPtr + 16, 0, 'i32');       // faceIgnoreData
    m.setValue(declPtr + 20, faceMatPtr, 'i32');
    m.setValue(declPtr + 24, 0, 'i32');       // faceVertexCount
    m.setValue(declPtr + 28, vertexCount, 'i32');
    m.setValue(declPtr + 32, 3 * 4, 'i32');   // vertexPositionStride = 12 bytes
    m.setValue(declPtr + 36, normals ? 3 * 4 : 0, 'i32');
    m.setValue(declPtr + 40, uvs ? 2 * 4 : 0, 'i32');
    m.setValue(declPtr + 44, indexCount, 'i32');
    m.setValue(declPtr + 48, 0, 'i32');       // indexOffset
    m.setValue(declPtr + 52, 0, 'i32');       // faceCount (0 = auto from indexCount/3)
    m.setValue(declPtr + 56, indexFormat, 'i32');
    // epsilon is already set by xatlasMeshDeclInit

    const error = m._xatlasAddMesh(this._ptr, declPtr, meshCountHint);

    // Free all temp allocations
    for (const p of allocs) m._free(p);

    return error;
  }

  /**
   * Add a UV mesh for repacking.
   * @param {object} opts
   * @param {Float32Array} opts.uvs         - Vertex UVs (flat xy).
   * @param {Uint16Array|Uint32Array} [opts.indices]
   * @param {Uint32Array} [opts.faceMaterialData]
   * @returns {number} AddMeshError code.
   */
  addUvMesh(opts) {
    const m = this._m;
    const { uvs, indices = null, faceMaterialData = null } = opts;

    const vertexCount = (uvs.length / 2) | 0;
    const declSize = m._xatlasUvMeshDecl_size();
    const declPtr = m._malloc(declSize);
    m.HEAPU8.fill(0, declPtr, declPtr + declSize);
    m._xatlasUvMeshDeclInit(declPtr);
    const allocs = [declPtr];

    const uvPtr = copyToHeap(m, uvs);
    allocs.push(uvPtr);

    let idxPtr = 0, indexCount = 0, indexFormat = IndexFormat.UInt16;
    if (indices) {
      idxPtr = copyToHeap(m, indices);
      allocs.push(idxPtr);
      indexCount = indices.length;
      indexFormat = indices instanceof Uint32Array ? IndexFormat.UInt32 : IndexFormat.UInt16;
    }

    let faceMatPtr = 0;
    if (faceMaterialData) {
      faceMatPtr = copyToHeap(m, faceMaterialData);
      allocs.push(faceMatPtr);
    }

    // UvMeshDecl struct layout:
    //  0: vertexUvData      (ptr)
    //  4: indexData          (ptr)
    //  8: faceMaterialData   (ptr)
    // 12: vertexCount        (u32)
    // 16: vertexStride       (u32)
    // 20: indexCount          (u32)
    // 24: indexOffset         (i32)
    // 28: indexFormat         (i32 enum)
    m.setValue(declPtr + 0, uvPtr, 'i32');
    m.setValue(declPtr + 4, idxPtr, 'i32');
    m.setValue(declPtr + 8, faceMatPtr, 'i32');
    m.setValue(declPtr + 12, vertexCount, 'i32');
    m.setValue(declPtr + 16, 2 * 4, 'i32'); // vertexStride = 8 bytes
    m.setValue(declPtr + 20, indexCount, 'i32');
    m.setValue(declPtr + 24, 0, 'i32');
    m.setValue(declPtr + 28, indexFormat, 'i32');

    const error = m._xatlasAddUvMesh(this._ptr, declPtr);
    for (const p of allocs) m._free(p);
    return error;
  }

  addMeshJoin() {
    this._m._xatlasAddMeshJoin(this._ptr);
  }

  /**
   * Compute charts for all added meshes.
   * @param {object} [opts]
   */
  computeCharts(opts) {
    const m = this._m;
    if (!opts) {
      m._xatlasComputeCharts(this._ptr, 0);
      return;
    }
    const size = m._xatlasChartOptions_size();
    const ptr = m._malloc(size);
    m._xatlasChartOptionsInit(ptr);
    this._writeChartOptions(ptr, opts);
    m._xatlasComputeCharts(this._ptr, ptr);
    m._free(ptr);
  }

  /**
   * Pack charts into atlas(es).
   * @param {object} [opts]
   */
  packCharts(opts) {
    const m = this._m;
    if (!opts) {
      m._xatlasPackCharts(this._ptr, 0);
      return;
    }
    const size = m._xatlasPackOptions_size();
    const ptr = m._malloc(size);
    m._xatlasPackOptionsInit(ptr);
    this._writePackOptions(ptr, opts);
    m._xatlasPackCharts(this._ptr, ptr);
    m._free(ptr);
  }

  /**
   * Generate atlas (computeCharts + packCharts in one call).
   * @param {object} [chartOptions]
   * @param {object} [packOptions]
   */
  generate(chartOptions, packOptions) {
    const m = this._m;
    let chartPtr = 0, packPtr = 0;

    if (chartOptions) {
      const size = m._xatlasChartOptions_size();
      chartPtr = m._malloc(size);
      m._xatlasChartOptionsInit(chartPtr);
      this._writeChartOptions(chartPtr, chartOptions);
    }

    if (packOptions) {
      const size = m._xatlasPackOptions_size();
      packPtr = m._malloc(size);
      m._xatlasPackOptionsInit(packPtr);
      this._writePackOptions(packPtr, packOptions);
    }

    m._xatlasGenerate(this._ptr, chartPtr, packPtr);

    if (chartPtr) m._free(chartPtr);
    if (packPtr) m._free(packPtr);
  }

  /**
   * Set progress callback. Pass null to clear.
   * @param {function|null} fn - (category: number, progress: number) => boolean
   */
  setProgressCallback(fn) {
    const m = this._m;
    if (this._progressFnPtr) {
      m.removeFunction(this._progressFnPtr);
      this._progressFnPtr = 0;
    }
    if (fn) {
      // Signature: bool(int, int, void*) → 'iiii' isn't right; Emscripten uses 'i' for return
      this._progressFnPtr = m.addFunction((category, progress, _userData) => {
        return fn(category, progress) ? 1 : 0;
      }, 'iiii');
      m._xatlasSetProgressCallback(this._ptr, this._progressFnPtr, 0);
    } else {
      m._xatlasSetProgressCallback(this._ptr, 0, 0);
    }
  }

  /* ── Result getters ──────────────────────────────────────────── */

  get width() { return this._m._xatlasAtlas_getWidth(this._ptr); }
  get height() { return this._m._xatlasAtlas_getHeight(this._ptr); }
  get atlasCount() { return this._m._xatlasAtlas_getAtlasCount(this._ptr); }
  get chartCount() { return this._m._xatlasAtlas_getChartCount(this._ptr); }
  get meshCount() { return this._m._xatlasAtlas_getMeshCount(this._ptr); }
  get texelsPerUnit() { return this._m._xatlasAtlas_getTexelsPerUnit(this._ptr); }

  getUtilization(atlasIndex) {
    return this._m._xatlasAtlas_getUtilization(this._ptr, atlasIndex);
  }

  /**
   * Retrieve output mesh data for a given input mesh index.
   * @param {number} meshIndex
   * @returns {{ vertexCount: number, indexCount: number, chartCount: number, vertices: Array, indices: Uint32Array, charts: Array }}
   */
  getMesh(meshIndex) {
    const m = this._m;
    const meshPtr = m._xatlasAtlas_getMesh(this._ptr, meshIndex);

    const vertexCount = m._xatlasMesh_getVertexCount(meshPtr);
    const indexCount = m._xatlasMesh_getIndexCount(meshPtr);
    const chartCount = m._xatlasMesh_getChartCount(meshPtr);

    // Read vertices
    const vertexArrayPtr = m._xatlasMesh_getVertexArray(meshPtr);
    const vertices = new Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
      vertices[i] = {
        atlasIndex: m._xatlasVertex_getAtlasIndex(vertexArrayPtr, i),
        chartIndex: m._xatlasVertex_getChartIndex(vertexArrayPtr, i),
        uv: [
          m._xatlasVertex_getUV0(vertexArrayPtr, i),
          m._xatlasVertex_getUV1(vertexArrayPtr, i),
        ],
        xref: m._xatlasVertex_getXref(vertexArrayPtr, i),
      };
    }

    // Read indices — copy from WASM heap
    const indexArrayPtr = m._xatlasMesh_getIndexArray(meshPtr);
    const indices = new Uint32Array(
      m.HEAPU32.buffer.slice(indexArrayPtr, indexArrayPtr + indexCount * 4)
    );

    // Read charts
    const chartArrayPtr = m._xatlasMesh_getChartArray(meshPtr);
    const charts = new Array(chartCount);
    for (let i = 0; i < chartCount; i++) {
      const faceCount = m._xatlasChart_getFaceCount(chartArrayPtr, i);
      const faceArrayPtr = m._xatlasChart_getFaceArray(chartArrayPtr, i);
      charts[i] = {
        atlasIndex: m._xatlasChart_getAtlasIndex(chartArrayPtr, i),
        faceCount,
        type: m._xatlasChart_getType(chartArrayPtr, i),
        material: m._xatlasChart_getMaterial(chartArrayPtr, i),
        faces: new Uint32Array(
          m.HEAPU32.buffer.slice(faceArrayPtr, faceArrayPtr + faceCount * 4)
        ),
      };
    }

    return { vertexCount, indexCount, chartCount, vertices, indices, charts };
  }

  /* ── Private: write option structs ─────────────────────────── */

  _writeChartOptions(ptr, opts) {
    const m = this._m;
    // ChartOptions struct layout:
    //  0: paramFunc             (ptr) - skip, leave default
    //  4: maxChartArea          (f32)
    //  8: maxBoundaryLength     (f32)
    // 12: normalDeviationWeight (f32)
    // 16: roundnessWeight       (f32)
    // 20: straightnessWeight    (f32)
    // 24: normalSeamWeight      (f32)
    // 28: textureSeamWeight     (f32)
    // 32: maxCost               (f32)
    // 36: maxIterations         (u32)
    // 40: useInputMeshUvs       (bool/i8)
    // 41: fixWinding            (bool/i8)
    const fields = [
      ['maxChartArea', 4, 'float'],
      ['maxBoundaryLength', 8, 'float'],
      ['normalDeviationWeight', 12, 'float'],
      ['roundnessWeight', 16, 'float'],
      ['straightnessWeight', 20, 'float'],
      ['normalSeamWeight', 24, 'float'],
      ['textureSeamWeight', 28, 'float'],
      ['maxCost', 32, 'float'],
      ['maxIterations', 36, 'i32'],
    ];
    for (const [name, offset, type] of fields) {
      if (opts[name] !== undefined) m.setValue(ptr + offset, opts[name], type);
    }
    if (opts.useInputMeshUvs !== undefined) m.setValue(ptr + 40, opts.useInputMeshUvs ? 1 : 0, 'i8');
    if (opts.fixWinding !== undefined) m.setValue(ptr + 41, opts.fixWinding ? 1 : 0, 'i8');
  }

  _writePackOptions(ptr, opts) {
    const m = this._m;
    // PackOptions struct layout:
    //  0: maxChartSize        (u32)
    //  4: padding             (u32)
    //  8: texelsPerUnit       (f32)
    // 12: resolution          (u32)
    // 16: bilinear            (bool/i8)
    // 17: blockAlign           (bool/i8)
    // 18: bruteForce           (bool/i8)
    // 19: createImage          (bool/i8)
    // 20: rotateChartsToAxis   (bool/i8)
    // 21: rotateCharts         (bool/i8)
    const intFields = [
      ['maxChartSize', 0, 'i32'],
      ['padding', 4, 'i32'],
      ['texelsPerUnit', 8, 'float'],
      ['resolution', 12, 'i32'],
    ];
    for (const [name, offset, type] of intFields) {
      if (opts[name] !== undefined) m.setValue(ptr + offset, opts[name], type);
    }
    const boolFields = [
      ['bilinear', 16],
      ['blockAlign', 17],
      ['bruteForce', 18],
      ['createImage', 19],
      ['rotateChartsToAxis', 20],
      ['rotateCharts', 21],
    ];
    for (const [name, offset] of boolFields) {
      if (opts[name] !== undefined) m.setValue(ptr + offset, opts[name] ? 1 : 0, 'i8');
    }
  }
}

/* ── Error/Category string helpers ───────────────────────────────── */

function addMeshErrorString(module, error) {
  const ptr = module._xatlasAddMeshErrorString(error);
  return module.UTF8ToString(ptr);
}

function progressCategoryString(module, category) {
  const ptr = module._xatlasProgressCategoryString(category);
  return module.UTF8ToString(ptr);
}

/* ── Module initializer ──────────────────────────────────────────── */

/**
 * Initialize the xatlas WASM module.
 * @param {object} [options]
 * @param {function} [options.locateFile] - Override for locating the .wasm file.
 * @returns {Promise<{ createAtlas: Function, addMeshErrorString: Function, progressCategoryString: Function, ChartType, IndexFormat, AddMeshError, ProgressCategory }>}
 */
export default async function createXAtlas(options = {}) {
  // Dynamically import the Emscripten-generated ESM glue
  const { default: createModule } = await import(
    /* webpackIgnore: true */ '../dist/xatlas.mjs'
  );

  const moduleOpts = {};
  if (options.locateFile) {
    moduleOpts.locateFile = options.locateFile;
  }

  const module = await createModule(moduleOpts);

  return {
    createAtlas: () => new XAtlas(module),
    addMeshErrorString: (error) => addMeshErrorString(module, error),
    progressCategoryString: (category) => progressCategoryString(module, category),
    ChartType,
    IndexFormat,
    AddMeshError,
    ProgressCategory,
  };
}
