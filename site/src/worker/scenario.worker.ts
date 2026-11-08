import createXAtlas, { type XAtlasModule } from 'xatlas-wasm';
import { getDemo } from '../demos/index.js';
import { runScenario } from './run-scenario.js';
import type { WorkerRequest, WorkerResponse } from './protocol.js';

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;
let modulePromise: Promise<XAtlasModule> | null = null;

function getModule(): Promise<XAtlasModule> {
  if (!modulePromise) {
    modulePromise = createXAtlas();
    modulePromise.catch(() => {
      // A failed initialization is retryable on the next request.
      modulePromise = null;
    });
  }
  return modulePromise;
}

scope.onmessage = (event): void => {
  const { id, type, demoId } = event.data;
  if (type !== 'run') return;

  void (async () => {
    try {
      const xatlas = await getModule();
      const demo = getDemo(demoId);
      if (!demo) throw new Error(`unknown scenario: ${demoId}`);

      const run = runScenario(xatlas, demo, (category, percent) => {
        scope.postMessage({ id, type: 'progress', category, percent });
      });

      const transfer: Transferable[] = [
        run.positions.buffer as ArrayBuffer,
        run.uvs.buffer as ArrayBuffer,
        run.chartIds.buffer as ArrayBuffer,
        run.atlasIds.buffer as ArrayBuffer,
        run.indices.buffer as ArrayBuffer,
      ];
      if (run.image) transfer.push(run.image.data.buffer as ArrayBuffer);

      scope.postMessage({ id, type: 'result', run }, transfer);
    } catch (error) {
      scope.postMessage({
        id,
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  })();
};
