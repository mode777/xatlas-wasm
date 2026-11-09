import type {
  AtlasImage,
  Chart,
  Mesh,
  MeshDeclOptions,
  UvMeshDeclOptions,
  XAtlas,
  XAtlasModule,
} from 'xatlas-wasm';
import type { DemoDefinition, DemoInput } from '../demos/types.js';

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

function normaliseInputs(
  input: DemoInput | readonly DemoInput[],
): readonly DemoInput[] {
  const inputs = Array.isArray(input) ? input : [input];
  if (inputs.length === 0) {
    throw new Error('scenario added no meshes');
  }
  for (const [index, entry] of inputs.entries()) {
    if (entry.kind !== 'mesh' || !entry.positions) {
      throw new Error(`scenario mesh ${index} requires positions`);
    }
  }
  return inputs;
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

    const inputs = normaliseInputs(
      demo.build({ xatlas, atlas, addMesh, addUvMesh }),
    );
    atlas.generate(demo.chartOptions, demo.packOptions);

    if (atlas.meshCount !== inputs.length) {
      throw new Error(
        `scenario added ${inputs.length} meshes but the atlas reports ${atlas.meshCount}`,
      );
    }

    const meshes: {
      readonly mesh: Mesh;
      readonly input: DemoInput;
    }[] = [];
    let outputVertexCount = 0;
    let outputIndexCount = 0;
    let inputVertexCount = 0;
    let inputFaceCount = 0;

    for (let index = 0; index < inputs.length; index++) {
      const input = inputs[index]!;
      const mesh = atlas.getMesh(index);
      if (mesh.vertexCount === 0 || mesh.indexCount === 0) {
        throw new Error(`scenario mesh ${index} produced no output`);
      }
      meshes.push({ mesh, input });
      outputVertexCount += mesh.vertexCount;
      outputIndexCount += mesh.indexCount;
      inputVertexCount += input.positions!.length / 3;
      inputFaceCount += input.indices.length / 3;
    }

    const width = atlas.width;
    const height = atlas.height;
    const positions = new Float32Array(outputVertexCount * 3);
    const uvs = new Float32Array(outputVertexCount * 2);
    const chartIds = new Int32Array(outputVertexCount);
    const atlasIds = new Int32Array(outputVertexCount);
    const indices = new Uint32Array(outputIndexCount);
    const charts: ScenarioChart[] = [];

    let vertexOffset = 0;
    let indexOffset = 0;
    for (const { mesh, input } of meshes) {
      for (let i = 0; i < mesh.vertexCount; i++) {
        const vertex = mesh.vertices[i]!;
        const source = vertex.xref * 3;
        positions[(vertexOffset + i) * 3] = input.positions![source]!;
        positions[(vertexOffset + i) * 3 + 1] = input.positions![source + 1]!;
        positions[(vertexOffset + i) * 3 + 2] = input.positions![source + 2]!;
        uvs[(vertexOffset + i) * 2] = width > 0 ? vertex.uv[0] / width : 0;
        uvs[(vertexOffset + i) * 2 + 1] = height > 0 ? vertex.uv[1] / height : 0;
        chartIds[vertexOffset + i] = vertex.chartIndex;
        atlasIds[vertexOffset + i] = vertex.atlasIndex;
      }
      for (let i = 0; i < mesh.indexCount; i++) {
        indices[indexOffset + i] = mesh.indices[i]! + vertexOffset;
      }
      charts.push(...mesh.charts.map(chartInfo));
      vertexOffset += mesh.vertexCount;
      indexOffset += mesh.indexCount;
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
      indices,
      image: copyImage(atlas.getImage()),
      charts,
      stats: {
        width,
        height,
        atlasCount: atlas.atlasCount,
        chartCount: atlas.chartCount,
        meshCount: atlas.meshCount,
        texelsPerUnit: atlas.texelsPerUnit,
        utilization,
        inputVertexCount,
        inputFaceCount,
        outputVertexCount,
        outputIndexCount,
        durationMs: performance.now() - started,
      },
    };
  } finally {
    atlas.destroy();
  }
}
