const countFormatter = new Intl.NumberFormat('en-US');

export function formatCount(value: number): string {
  return countFormatter.format(value);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatDuration(milliseconds: number): string {
  if (milliseconds >= 1000) {
    return `${(milliseconds / 1000).toFixed(2)} s`;
  }
  return `${Math.round(milliseconds)} ms`;
}

/** Format only the options a scenario explicitly set, for the recipe panel. */
export function formatOptionList(options: object | undefined): string[] {
  if (!options) return [];
  const entries: string[] = [];
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue;
    entries.push(`${key}: ${String(value)}`);
  }
  return entries;
}
