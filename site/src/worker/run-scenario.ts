import type {
  AtlasImage,
  Chart,
  MeshDeclOptions,
  UvMeshDeclOptions,
  XAtlas,
  XAtlasModule,
} from 'xatlas-wasm';
import type { DemoDefinition } from '../demos/types.js';

export interface ScenarioChart {
  readonly atlasIndex: number;
  readonly faceCount: number;
  readonly type: number;
  readonly material: number;
}

export interface ScenarioStats {
  readonly width: number;
  readonly height: number;
  readonly atlasCount: number;
  readonly chartCount: number;
  readonly meshCount: number;
  readonly texelsPerUnit: number;
  readonly utilization: readonly number[];
  readonly inputVertexCount: number;
  readonly inputFaceCount: number;
  readonly outputVertexCount: number;
  readonly outputIndexCount: number;
  readonly durationMs: number;
}

export interface ScenarioImage {
  readonly width: number;
  readonly height: number;
  readonly atlasCount: number;
  readonly data: Uint32Array;
}

export interface ScenarioRun {
  readonly demoId: string;
  readonly positions: Float32Array;
  readonly uvs: Float32Array;
  readonly chartIds: Int32Array;
  readonly atlasIds: Int32Array;
  readonly indices: Uint32Array;
  readonly image: ScenarioImage | null;
  readonly charts: readonly ScenarioChart[];
  readonly stats: ScenarioStats;
}

export type ProgressHandler = (category: string, percent: number) => void;

function copyImage(image: AtlasImage | null): ScenarioImage | null {
  if (!image) return null;
  return {
    width: image.width,
    height: image.height,
    atlasCount: image.atlasCount,
    data: image.data,
  };
}

function chartInfo(chart: Chart): ScenarioChart {
  return {
    atlasIndex: chart.atlasIndex,
    faceCount: chart.faceCount,
    type: chart.type,
    material: chart.material,
  };
}

/**
 * Run one scenario against one module instance. The atlas is always destroyed
 * in `finally`; the returned arrays are copies owned by the caller.
 */
export function runScenario(
  xatlas: XAtlasModule,
  demo: DemoDefinition,
  onProgress?: ProgressHandler,
): ScenarioRun {
  const started = performance.now();
  const atlas: XAtlas = xatlas.createAtlas();

  const addMesh = (options: MeshDeclOptions): void => {
    const error = atlas.addMesh(options);
    if (error !== xatlas.AddMeshError.Success) {
      throw new Error(
        `addMesh failed: ${xatlas.addMeshErrorString(error)} (${error})`,
      );
    }
  };

  const addUvMesh = (options: UvMeshDeclOptions): void => {
    const error = atlas.addUvMesh(options);
    if (error !== xatlas.AddMeshError.Success) {
      throw new Error(
        `addUvMesh failed: ${xatlas.addMeshErrorString(error)} (${error})`,
      );
    }
  };

  try {
    if (onProgress) {
      atlas.setProgressCallback((category, percent) => {
        onProgress(xatlas.progressCategoryString(category), percent);
        return true;
      });
    }

    const input = demo.build({ xatlas, atlas, addMesh, addUvMesh });
    if (input.kind !== 'mesh' || !input.positions) {
      throw new Error('only mesh scenarios are supported in this showcase');
    }

    atlas.generate(demo.chartOptions, demo.packOptions);

    const mesh = atlas.getMesh(0);
    const width = atlas.width;
    const height = atlas.height;
    const vertexCount = mesh.vertexCount;

    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const chartIds = new Int32Array(vertexCount);
    const atlasIds = new Int32Array(vertexCount);

    for (let i = 0; i < vertexCount; i++) {
      const vertex = mesh.vertices[i]!;
      const source = vertex.xref * 3;
      positions[i * 3] = input.positions[source]!;
      positions[i * 3 + 1] = input.positions[source + 1]!;
      positions[i * 3 + 2] = input.positions[source + 2]!;
      uvs[i * 2] = width > 0 ? vertex.uv[0] / width : 0;
      uvs[i * 2 + 1] = height > 0 ? vertex.uv[1] / height : 0;
      chartIds[i] = vertex.chartIndex;
      atlasIds[i] = vertex.atlasIndex;
    }

    const utilization: number[] = [];
    for (let i = 0; i < atlas.atlasCount; i++) {
      utilization.push(atlas.getUtilization(i));
    }

    return {
      demoId: demo.meta.id,
      positions,
      uvs,
      chartIds,
      atlasIds,
      indices: mesh.indices,
      image: copyImage(atlas.getImage()),
      charts: mesh.charts.map(chartInfo),
      stats: {
        width,
        height,
        atlasCount: atlas.atlasCount,
        chartCount: atlas.chartCount,
        meshCount: atlas.meshCount,
        texelsPerUnit: atlas.texelsPerUnit,
        utilization,
        inputVertexCount: input.positions.length / 3,
        inputFaceCount: input.indices.length / 3,
        outputVertexCount: mesh.vertexCount,
        outputIndexCount: mesh.indexCount,
        durationMs: performance.now() - started,
      },
    };
  } finally {
    atlas.destroy();
  }
}
