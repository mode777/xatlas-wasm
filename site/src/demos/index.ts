import cube from './scenarios/cube.js';
import gazebo from './scenarios/gazebo.js';
import multiAtlas from './scenarios/multi-atlas.js';
import packingLab from './scenarios/packing-lab.js';
import terrain from './scenarios/terrain.js';
import uvSphere from './scenarios/uv-sphere.js';
import type { DemoDefinition, DemoMeta } from './types.js';

/** The showcase catalog. Scenario modules stay free of DOM and three.js. */
export const demos: readonly DemoDefinition[] = [
  gazebo,
  cube,
  uvSphere,
  terrain,
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
