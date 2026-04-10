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

/** Add signed calendar days to a YYYY-MM-DD (local calendar math). */
export function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const d = parseYmd(ymd);
  if (Number.isNaN(d.getTime())) return ymd;
  d.setDate(d.getDate() + deltaDays);
  return formatYmd(d);
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

/** Calendar YYYY-MM-DD for `date` interpreted in `timeZone` (e.g. user profile). */
export function formatYmdInTimeZone(timeZone: string, date: Date = new Date()): string {
  try {
    const dtf = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = dtf.formatToParts(date);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    /* invalid TZ */
  }
  return formatYmd(date);
}

/**
 * A `Date` that maps to `ymd` via `formatYmdInTimeZone` (planning horizon / drift "as of" day).
 */
export function dateForUserCalendarDay(timeZone: string, ymd: string): Date {
  const parts = ymd.split('-').map(Number);
  const y = parts[0];
  const mo = parts[1];
  const d = parts[2];
  if (y === undefined || mo === undefined || d === undefined) {
    return new Date();
  }
  let candidate = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  for (let i = 0; i < 12; i++) {
    const got = formatYmdInTimeZone(timeZone, candidate);
    if (got === ymd) return candidate;
    if (got < ymd) {
      candidate = new Date(candidate.getTime() + 86400000);
    } else {
      candidate = new Date(candidate.getTime() - 86400000);
    }
  }
  return candidate;
}
