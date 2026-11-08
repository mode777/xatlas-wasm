/**
 * Worker entry for test/worker.test.mjs.
 *
 * Runs a whole xatlas-wasm module inside a Node worker thread, generates an
 * atlas for a unit quad, and posts the result to the parent.
 */

import { parentPort } from 'node:worker_threads';
import createXAtlas from '../dist/index.mjs';

if (process.env.WORKER_TEST_FAIL === '1') {
  throw new Error('worker failure requested by WORKER_TEST_FAIL');
}

const positions = new Float32Array([
  0, 0, 0,
  1, 0, 0,
  1, 1, 0,
  0, 1, 0,
]);
const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);

const xatlas = await createXAtlas();
const atlas = xatlas.createAtlas();
const error = atlas.addMesh({ positions, indices });
if (error !== xatlas.AddMeshError.Success) {
  throw new Error(`addMesh failed: ${xatlas.addMeshErrorString(error)}`);
}

atlas.generate();
const mesh = atlas.getMesh(0);
const result = {
  width: atlas.width,
  height: atlas.height,
  vertexCount: mesh.vertexCount,
  indexCount: mesh.indexCount,
};
atlas.destroy();

parentPort.postMessage(result);
