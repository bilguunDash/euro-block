export function mergeRowsByKey<T extends { key: string }>(defaults: T[], saved: unknown): T[] {
  const arr = Array.isArray(saved) ? (saved as any[]) : [];
  if (!arr.length) return defaults;
  const byKey = new Map<string, any>(arr.map((row) => [String(row?.key ?? ''), row]));
  return defaults.map((defaultRow) => {
    const savedRow = byKey.get(defaultRow.key);
    return savedRow && typeof savedRow === 'object' ? ({ ...defaultRow, ...savedRow } as T) : defaultRow;
  });
}
