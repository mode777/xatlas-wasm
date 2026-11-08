const sources = import.meta.glob('./scenarios/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const byId = new Map(
  Object.entries(sources).map(([path, source]) => {
    const name = path.split('/').pop() ?? '';
    return [name.replace(/\.ts$/, ''), source] as const;
  }),
);

/** The exact source a scenario module was built from, for the Code view. */
export function getScenarioSource(id: string): string {
  return byId.get(id) ?? '';
}

/** Used by the source-coverage test. */
export function scenarioSourceIds(): readonly string[] {
  return [...byId.keys()];
}
