/**
 * Inclusive calendar dates (YYYY-MM-DD) without mixing UTC `toISOString()` and local
 * `setDate()` — that bug can skip/duplicate days and misalign plan blocks with the UI.
 */

export function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as local calendar noon (stable across DST). */
export function parseYmd(isoDate: string): Date {
  const parts = isoDate.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (y === undefined || m === undefined || d === undefined) {
    return new Date(NaN);
  }
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Every calendar day from periodStart through periodEnd (inclusive). */
export function eachYmdInRange(periodStart: string, periodEnd: string): string[] {
  const out: string[] = [];
  let cur = parseYmd(periodStart);
  const end = parseYmd(periodEnd);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime())) return out;
  while (cur <= end) {
    out.push(formatYmd(cur));
    const next = new Date(cur);
    next.setDate(next.getDate() + 1);
    cur = next;
  }
  return out;
}
