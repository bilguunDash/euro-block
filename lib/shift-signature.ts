/** Prefer a saved name; blank and dash placeholders are not names. */
export function resolveReceivingName(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    const name = typeof candidate === 'string' ? candidate.trim() : '';
    if (name && !/^[—–-]+$/.test(name)) return name;
  }
  return '';
}
