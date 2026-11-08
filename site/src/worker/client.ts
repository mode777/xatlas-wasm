import type { WorkerRequest, WorkerResponse } from './protocol.js';
import type { ScenarioRun } from './run-scenario.js';

interface Pending {
  readonly resolve: (run: ScenarioRun) => void;
  readonly reject: (error: Error) => void;
  readonly onProgress?: (category: string, percent: number) => void;
}

/** Promise-based client for the single scenario worker. */
export class ScenarioClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private closed = false;

  constructor() {
    this.worker = new Worker(
      new URL('./scenario.worker.ts', import.meta.url),
      { type: 'module' },
    );
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.id);
      if (!pending) return;

      if (response.type === 'progress') {
        pending.onProgress?.(response.category, response.percent);
        return;
      }

      this.pending.delete(response.id);
      if (response.type === 'error') {
        pending.reject(new Error(response.message));
      } else {
        pending.resolve(response.run);
      }
    };
    this.worker.onerror = (event) => {
      this.failAll(new Error(event.message || 'the scenario worker failed'));
    };
  }

  run(
    demoId: string,
    onProgress?: (category: string, percent: number) => void,
  ): Promise<ScenarioRun> {
    if (this.closed) {
      return Promise.reject(new Error('the scenario worker is not running'));
    }
    const id = this.nextId++;
    return new Promise<ScenarioRun>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      const request: WorkerRequest = { id, type: 'run', demoId };
      this.worker.postMessage(request);
    });
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.worker.terminate();
    this.failAll(new Error('the scenario worker was disposed'));
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}
