import type {
  ChartOptions,
  MeshDeclOptions,
  PackOptions,
  UvMeshDeclOptions,
  XAtlas,
  XAtlasModule,
} from 'xatlas-wasm';

/** Metadata shown in the gallery and on the scenario page. */
export interface DemoMeta {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly features: readonly string[];
  readonly input: 'generated' | 'asset';
}

/** What a scenario returns to the worker after adding its mesh. */
export interface DemoInput {
  readonly kind: 'mesh' | 'uv';
  readonly positions?: Float32Array;
  readonly normals?: Float32Array;
  readonly uvs?: Float32Array;
  readonly indices: Uint32Array;
}

/** Helpers the worker gives a scenario so it can own its xatlas calls. */
export interface DemoContext {
  readonly xatlas: XAtlasModule;
  readonly atlas: XAtlas;
  addMesh(options: MeshDeclOptions): void;
  addUvMesh(options: UvMeshDeclOptions): void;
}

/** A pure scenario module: metadata, recipe and the mesh it unwraps. */
export interface DemoDefinition {
  readonly meta: DemoMeta;
  readonly chartOptions?: ChartOptions;
  readonly packOptions?: PackOptions;
  build(context: DemoContext): DemoInput;
}
