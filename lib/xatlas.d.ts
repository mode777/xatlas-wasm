/**
 * xatlas-wasm — TypeScript definitions for the xatlas WebAssembly module.
 */

/** Chart parameterization type. */
export declare const ChartType: {
  /** Chart is on a single plane. */
  readonly Planar: 0;
  /** Chart is parameterized with an orthogonal projection. */
  readonly Ortho: 1;
  /** Chart is parameterized with Least Squares Conformal Map. */
  readonly LSCM: 2;
  /** Chart is parameterized piecewise. */
  readonly Piecewise: 3;
  /** Invalid chart type. */
  readonly Invalid: 4;
};
export type ChartType = (typeof ChartType)[keyof typeof ChartType];

/** Index buffer data format. */
export declare const IndexFormat: {
  readonly UInt16: 0;
  readonly UInt32: 1;
};
export type IndexFormat = (typeof IndexFormat)[keyof typeof IndexFormat];

/** Error codes returned by addMesh / addUvMesh. */
export declare const AddMeshError: {
  /** No error. */
  readonly Success: 0;
  /** Unspecified error. */
  readonly Error: 1;
  /** An index is >= vertex count. */
  readonly IndexOutOfRange: 2;
  /** Face vertex count must be >= 3. */
  readonly InvalidFaceVertexCount: 3;
  /** Index count not evenly divisible by 3 (expecting triangles). */
  readonly InvalidIndexCount: 4;
};
export type AddMeshError = (typeof AddMeshError)[keyof typeof AddMeshError];

/** Progress callback category. */
export declare const ProgressCategory: {
  readonly AddMesh: 0;
  readonly ComputeCharts: 1;
  readonly PackCharts: 2;
  readonly BuildOutputMeshes: 3;
};
export type ProgressCategory =
  (typeof ProgressCategory)[keyof typeof ProgressCategory];

/* ── Input option types ──────────────────────────────────────────── */

/** Options for adding a triangle mesh. */
export interface MeshDeclOptions {
  /** Vertex positions, flat xyz (length must be vertexCount * 3). */
  positions: Float32Array;
  /** Optional vertex normals, flat xyz. */
  normals?: Float32Array;
  /** Optional vertex UVs, flat xy. Provided as a hint to the chart generator. */
  uvs?: Float32Array;
  /** Optional triangle indices. If omitted, vertices are assumed to be non-indexed triangles. */
  indices?: Uint16Array | Uint32Array;
  /** Optional per-face material IDs. Only faces with the same material will be in the same chart. */
  faceMaterialData?: Uint32Array;
  /** Optional hint for total mesh count, can improve performance for multiple meshes. */
  meshCountHint?: number;
}

/** Options for adding a UV mesh (for repacking). */
export interface UvMeshDeclOptions {
  /** Vertex UVs, flat xy. */
  uvs: Float32Array;
  /** Optional triangle indices. */
  indices?: Uint16Array | Uint32Array;
  /** Optional per-face material IDs. Overlapping UVs should have different materials. */
  faceMaterialData?: Uint32Array;
}

/** Options for chart computation. */
export interface ChartOptions {
  /**
   * Don't grow charts to be larger than this. 0 means no limit.
   * @default 0
   */
  maxChartArea?: number;
  /**
   * Don't grow charts to have a longer boundary than this. 0 means no limit.
   * @default 0
   */
  maxBoundaryLength?: number;
  /**
   * Weight for angle between face and average chart normal.
   * @default 2.0
   */
  normalDeviationWeight?: number;
  /**
   * Weight for chart roundness.
   * @default 0.01
   */
  roundnessWeight?: number;
  /**
   * Weight for chart boundary straightness.
   * @default 6.0
   */
  straightnessWeight?: number;
  /**
   * Weight for normal seams. If > 1000, normal seams are fully respected.
   * @default 4.0
   */
  normalSeamWeight?: number;
  /**
   * Weight for texture seams.
   * @default 0.5
   */
  textureSeamWeight?: number;
  /**
   * If total of all metrics * weights > maxCost, don't grow chart. Lower values result in more charts.
   * @default 2.0
   */
  maxCost?: number;
  /**
   * Number of iterations of chart growing and seeding phases. Higher values produce better charts.
   * @default 1
   */
  maxIterations?: number;
  /**
   * Use MeshDecl vertex UVs for charts.
   * @default false
   */
  useInputMeshUvs?: boolean;
  /**
   * Enforce consistent texture coordinate winding.
   * @default false
   */
  fixWinding?: boolean;
}

/** Options for chart packing. */
export interface PackOptions {
  /**
   * Charts larger than this will be scaled down. 0 means no limit.
   * @default 0
   */
  maxChartSize?: number;
  /**
   * Number of pixels to pad charts with.
   * @default 0
   */
  padding?: number;
  /**
   * Unit to texel scale. e.g. a 1x1 quad with texelsPerUnit of 32 will take up ~32x32 texels.
   * If 0, an estimated value will be calculated to match the given resolution.
   * @default 0
   */
  texelsPerUnit?: number;
  /**
   * If 0, generate a single atlas with texelsPerUnit determining the resolution.
   * If not 0 and texelsPerUnit is not 0, generate one or more atlases with that exact resolution.
   * @default 0
   */
  resolution?: number;
  /**
   * Leave space around charts for texels that would be sampled by bilinear filtering.
   * @default true
   */
  bilinear?: boolean;
  /**
   * Align charts to 4x4 blocks. Improves packing speed.
   * @default false
   */
  blockAlign?: boolean;
  /**
   * Slower, but gives the best result. If false, use random chart placement.
   * @default false
   */
  bruteForce?: boolean;
  /**
   * Create the atlas image (accessible from the atlas result).
   * @default false
   */
  createImage?: boolean;
  /**
   * Rotate charts to the axis of their convex hull.
   * @default true
   */
  rotateChartsToAxis?: boolean;
  /**
   * Rotate charts to improve packing.
   * @default true
   */
  rotateCharts?: boolean;
}

/* ── Output types ────────────────────────────────────────────────── */

/** Output vertex. */
export interface Vertex {
  /** Sub-atlas index. -1 if the vertex doesn't exist in any atlas. */
  atlasIndex: number;
  /** Chart index. -1 if the vertex doesn't exist in any chart. */
  chartIndex: number;
  /** UV coordinates. Not normalized — values are in atlas width/height range. */
  uv: [number, number];
  /** Index of input vertex from which this output vertex originated. */
  xref: number;
}

/** Output chart. */
export interface Chart {
  /** Sub-atlas index. */
  atlasIndex: number;
  /** Number of faces in this chart. */
  faceCount: number;
  /** Chart parameterization type. */
  type: ChartType;
  /** Material index. */
  material: number;
  /** Face indices belonging to this chart. */
  faces: Uint32Array;
}

/** Output mesh, corresponding to each addMesh call. */
export interface Mesh {
  /** Number of output vertices. */
  vertexCount: number;
  /** Number of output indices. */
  indexCount: number;
  /** Number of charts. */
  chartCount: number;
  /** Output vertices with atlas UVs and xrefs back to input vertices. */
  vertices: Vertex[];
  /** Output triangle indices into the vertices array. */
  indices: Uint32Array;
  /** Charts in this mesh. */
  charts: Chart[];
}

/**
 * Progress callback function.
 * @param category - The current processing stage.
 * @param progress - Progress percentage (0–100).
 * @returns Return false to cancel.
 */
export type ProgressCallback = (
  category: ProgressCategory,
  progress: number
) => boolean;

/** An xatlas atlas instance. */
export interface XAtlas {
  /**
   * Add a triangle mesh to the atlas.
   * @returns An AddMeshError code. 0 (Success) on success.
   */
  addMesh(options: MeshDeclOptions): AddMeshError;

  /**
   * Add a UV mesh for repacking.
   * @returns An AddMeshError code. 0 (Success) on success.
   */
  addUvMesh(options: UvMeshDeclOptions): AddMeshError;

  /** Wait for async AddMesh processing to finish. Called internally by computeCharts/generate. */
  addMeshJoin(): void;

  /**
   * Compute charts for all added meshes. Can be called multiple times with different options.
   */
  computeCharts(options?: ChartOptions): void;

  /**
   * Pack charts into atlas(es). Call after computeCharts.
   */
  packCharts(options?: PackOptions): void;

  /**
   * Generate atlas (equivalent to computeCharts + packCharts). Can be called multiple times.
   */
  generate(chartOptions?: ChartOptions, packOptions?: PackOptions): void;

  /**
   * Set a progress callback. Pass null to clear.
   */
  setProgressCallback(callback: ProgressCallback | null): void;

  /** Atlas width in texels. Populated after packing. */
  readonly width: number;
  /** Atlas height in texels. Populated after packing. */
  readonly height: number;
  /** Number of sub-atlases. */
  readonly atlasCount: number;
  /** Total number of charts across all meshes. */
  readonly chartCount: number;
  /** Number of output meshes (equal to number of addMesh calls). */
  readonly meshCount: number;
  /** Texels per unit. */
  readonly texelsPerUnit: number;

  /**
   * Get normalized atlas texel utilization for a sub-atlas.
   * A value of 0.8 means 20% empty space.
   */
  getUtilization(atlasIndex: number): number;

  /**
   * Retrieve output mesh data for a given input mesh index.
   */
  getMesh(meshIndex: number): Mesh;

  /** Destroy the atlas and free all associated memory. */
  destroy(): void;
}

/** Options for initializing the xatlas WASM module. */
export interface CreateXAtlasOptions {
  /**
   * Override the default .wasm file location.
   * Called by Emscripten to resolve the path to the .wasm file.
   */
  locateFile?: (path: string, prefix: string) => string;
}

/** The xatlas module API returned by initialization. */
export interface XAtlasModule {
  /** Create a new atlas instance. */
  createAtlas(): XAtlas;
  /** Get a human-readable string for an AddMeshError code. */
  addMeshErrorString(error: AddMeshError): string;
  /** Get a human-readable string for a ProgressCategory code. */
  progressCategoryString(category: ProgressCategory): string;

  readonly ChartType: typeof ChartType;
  readonly IndexFormat: typeof IndexFormat;
  readonly AddMeshError: typeof AddMeshError;
  readonly ProgressCategory: typeof ProgressCategory;
}

/**
 * Initialize the xatlas WASM module.
 *
 * @example
 * ```js
 * import createXAtlas from 'xatlas-wasm';
 *
 * const xatlas = await createXAtlas();
 * const atlas = xatlas.createAtlas();
 * atlas.addMesh({ positions, indices });
 * atlas.generate();
 * const mesh = atlas.getMesh(0);
 * atlas.destroy();
 * ```
 */
export default function createXAtlas(
  options?: CreateXAtlasOptions
): Promise<XAtlasModule>;
