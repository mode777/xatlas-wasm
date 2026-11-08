import type { ScenarioRun } from '../worker/run-scenario.js';

function finite(value: number, label: string): string {
  if (!Number.isFinite(value)) {
    throw new Error(`cannot export non-finite ${label}`);
  }
  return value.toFixed(6);
}

/**
 * Serialize the displayed output mesh as Wavefront OBJ with one `v` and one
 * `vt` per output vertex, so face indices are 1:1.
 */
export function serializeObj(run: ScenarioRun): string {
  const lines: string[] = [
    `# xatlas-wasm showcase: ${run.demoId}`,
    `# ${run.stats.outputVertexCount} vertices, ${run.stats.outputIndexCount / 3} faces`,
  ];

  for (let i = 0; i < run.stats.outputVertexCount; i++) {
    lines.push(
      `v ${finite(run.positions[i * 3]!, 'position')} ${finite(
        run.positions[i * 3 + 1]!,
        'position',
      )} ${finite(run.positions[i * 3 + 2]!, 'position')}`,
    );
  }
  for (let i = 0; i < run.stats.outputVertexCount; i++) {
    lines.push(
      `vt ${finite(run.uvs[i * 2]!, 'uv')} ${finite(
        run.uvs[i * 2 + 1]!,
        'uv',
      )}`,
    );
  }
  for (let i = 0; i < run.indices.length; i += 3) {
    const a = run.indices[i]! + 1;
    const b = run.indices[i + 1]! + 1;
    const c = run.indices[i + 2]! + 1;
    lines.push(`f ${a}/${a} ${b}/${b} ${c}/${c}`);
  }

  return `${lines.join('\n')}\n`;
}
