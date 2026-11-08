import * as THREE from 'three';
import type { ScenarioRun } from '../worker/run-scenario.js';
import { chartColor } from './palette.js';

/** Full indexed geometry for shaded, checker and chart-color modes. */
export function buildFullGeometry(
  run: ScenarioRun,
  withChartColors = false,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(run.positions, 3),
  );
  geometry.setAttribute('uv', new THREE.BufferAttribute(run.uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(run.indices, 1));

  if (withChartColors) {
    const colors = new Float32Array(run.chartIds.length * 3);
    const color = new THREE.Color();
    for (let i = 0; i < run.chartIds.length; i++) {
      color.set(chartColor(run.chartIds[i]!, 0.58));
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Non-indexed geometry containing only the triangles belonging to one
 * sub-atlas. Used by the atlas-texture mode so another atlas's UVs cannot
 * sample the wrong image.
 */
export function buildAtlasGeometry(
  run: ScenarioRun,
  atlasIndex: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];

  for (let i = 0; i < run.indices.length; i += 3) {
    const a = run.indices[i]!;
    if (run.atlasIds[a] !== atlasIndex) continue;
    for (const index of [a, run.indices[i + 1]!, run.indices[i + 2]!]) {
      positions.push(
        run.positions[index * 3]!,
        run.positions[index * 3 + 1]!,
        run.positions[index * 3 + 2]!,
      );
      uvs.push(run.uvs[index * 2]!, run.uvs[index * 2 + 1]!);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Bounding box of the full output mesh, used to frame the camera. */
export function boundsOf(run: ScenarioRun): THREE.Box3 {
  return new THREE.Box3().setFromBufferAttribute(
    new THREE.BufferAttribute(run.positions, 3),
  );
}
