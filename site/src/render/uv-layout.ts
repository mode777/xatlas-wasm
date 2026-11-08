import type { ScenarioRun } from '../worker/run-scenario.js';

/** xatlas UVs are normalized; canvas y grows downward. */
export function uvToCanvas(
  u: number,
  v: number,
  width: number,
  height: number,
): readonly [number, number] {
  return [u * width, (1 - v) * height];
}

export function triangleAtlasId(run: ScenarioRun, triangle: number): number {
  const index = run.indices[triangle * 3];
  return index === undefined ? -1 : (run.atlasIds[index] ?? -1);
}

export function triangleChartId(run: ScenarioRun, triangle: number): number {
  const index = run.indices[triangle * 3];
  return index === undefined ? -1 : (run.chartIds[index] ?? -1);
}
