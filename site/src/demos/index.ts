import gazebo from './scenarios/gazebo.js';
import milkTruck from './scenarios/milk-truck.js';
import townLevel from './scenarios/town-level.js';
import uvSphere from './scenarios/uv-sphere.js';
import packingLab from './scenarios/packing-lab.js';
import multiAtlas from './scenarios/multi-atlas.js';
import type { DemoDefinition, DemoMeta } from './types.js';

/** The showcase catalog. Scenario modules stay free of DOM and three.js. */
export const demos: readonly DemoDefinition[] = [
  gazebo,
  milkTruck,
  townLevel,
  uvSphere,
  packingLab,
  multiAtlas,
];

const byId = new Map(demos.map((demo) => [demo.meta.id, demo]));

export function getDemo(id: string): DemoDefinition | undefined {
  return byId.get(id);
}

export function demoMetaList(): readonly DemoMeta[] {
  return demos.map((demo) => demo.meta);
}
