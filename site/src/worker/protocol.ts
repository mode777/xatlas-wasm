import type { ScenarioRun } from './run-scenario.js';

export type WorkerRequest = {
  readonly id: number;
  readonly type: 'run';
  readonly demoId: string;
};

export type WorkerResponse =
  | {
      readonly id: number;
      readonly type: 'progress';
      readonly category: string;
      readonly percent: number;
    }
  | {
      readonly id: number;
      readonly type: 'result';
      readonly run: ScenarioRun;
    }
  | {
      readonly id: number;
      readonly type: 'error';
      readonly message: string;
    };
