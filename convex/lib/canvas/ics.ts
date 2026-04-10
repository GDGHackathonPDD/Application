interface ParsedVEvent {
  uid: string;
  summary: string;
  dtstart?: string;
  dtend?: string;
  due?: string;
  /** First `CATEGORIES` value, else URL-derived key — from the .ics only. */
  calendarGroupKey?: string;
  /** RFC 5545 SEQUENCE; lower = earlier revision / intended order. */
  icsSequence?: number;
}

/** Internal while scanning one VEVENT. */
interface BuildingVEvent {
  uid?: string;
  summary?: string;
  dtstart?: string;
  dtend?: string;
  due?: string;
  categoriesKey?: string;
  urlGroupKey?: string;
  icsSequence?: number;
}

function isAllDigits(s: string): boolean {
  if (s.length === 0) return false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  return true;
}

/** Many LMS calendar URLs use `/courses/<id>/…` — optional fallback when `CATEGORIES` is absent. */
export function calendarGroupKeyFromEventUrl(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    const segs = u.pathname.split("/").filter((s) => s.length > 0);
    const idx = segs.indexOf("courses");
    if (idx < 0 || idx >= segs.length - 1) return null;
    const id = segs[idx + 1];
    return id !== undefined && isAllDigits(id) ? id : null;
  } catch {
    return null;
  }
}

function extractHttpUrlFromIcsLine(line: string): string | null {
  let start = line.indexOf("https://");
  if (start < 0) start = line.indexOf("http://");
  if (start < 0) return null;
  let end = line.length;
  for (let j = start; j < line.length; j++) {
    const ch = line[j];
    if (ch === " " || ch === "\r" || ch === "\n" || ch === "\t") {
      end = j;
      break;
    }
  }
  return line.slice(start, end);
}

function firstCategoryFromCategoriesLine(line: string): string | null {
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return null;
  const raw = line.slice(colonIdx + 1).trim();
  if (raw.length === 0) return null;
  const first = raw.split(",")[0].trim();
  return first.length > 0 ? first : null;
}

function finalizeParsedEvent(b: BuildingVEvent): ParsedVEvent | null {
  if (!b.uid || !b.summary) return null;
  const calendarGroupKey = b.categoriesKey ?? b.urlGroupKey;
  return {
    uid: b.uid,
    summary: b.summary,
    dtstart: b.dtstart,
    dtend: b.dtend,
    due: b.due,
    ...(calendarGroupKey ? { calendarGroupKey } : {}),
    ...(b.icsSequence !== undefined ? { icsSequence: b.icsSequence } : {}),
  };
}

/** Parse ICS text into VEVENT summaries (UID + SUMMARY + optional dates). */
export function parseICS(text: string): ParsedVEvent[] {
  const events: ParsedVEvent[] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let inEvent = false;
  let current: BuildingVEvent = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      inEvent = false;
      const done = finalizeParsedEvent(current);
      if (done) events.push(done);
      continue;
    }
    if (!inEvent) continue;

    if (line.startsWith('UID')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx >= 0) current.uid = line.slice(colonIdx + 1).trim();
    } else if (line.startsWith('SUMMARY')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx >= 0) current.summary = line.slice(colonIdx + 1).trim();
    } else if (line.startsWith('DTSTART') || line.startsWith('DTSTART;')) {
      current.dtstart = extractICSDate(line);
    } else if (line.startsWith('DUE') || line.startsWith('DUE;')) {
      current.due = extractICSDate(line);
    } else if (line.startsWith('DTEND') || line.startsWith('DTEND;')) {
      current.dtend = extractICSDate(line);
    } else if (line.startsWith('CATEGORIES')) {
      const cat = firstCategoryFromCategoriesLine(line);
      if (cat) current.categoriesKey = cat;
    } else if (line.startsWith('URL') || line.startsWith('URL;')) {
      const href = extractHttpUrlFromIcsLine(line);
      if (href) {
        const key = calendarGroupKeyFromEventUrl(href);
        if (key) current.urlGroupKey = key;
      }
    } else if (line.startsWith('SEQUENCE')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx >= 0) {
        const n = parseInt(line.slice(colonIdx + 1).trim(), 10);
        if (!Number.isNaN(n)) current.icsSequence = n;
      }
    }
  }

  return events;
}

function extractICSDate(line: string): string {
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return '';
  const raw = line.slice(colonIdx + 1).trim();
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length >= 8) {
    const year = digits.slice(0, 4);
    const month = digits.slice(4, 6);
    const day = digits.slice(6, 8);
    return `${year}-${month}-${day}`;
  }
  return raw;
}

const PALETTE = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6',
];

export function colorForUid(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/**
 * Optional Convex env: comma-separated extra hostnames allowed for ICS (testing / self-hosted).
 * Set in the Convex dashboard (Settings → Environment Variables), e.g. `canvas.myuni.edu` or `localhost`.
 */
function extraAllowedHosts(): string[] {
  const raw = process.env.CANVAS_ICS_EXTRA_ALLOWED_HOSTS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((h) => h.length > 0);
}

function hostMatchesExtra(host: string, entry: string): boolean {
  if (host === entry) return true;
  if (host.endsWith(`.${entry}`)) return true;
  return false;
}

/** spec-backend §2.2b — ICS URL is a capability token; restrict fetch targets. */
export function assertCanvasIcsFeedUrlAllowed(feedUrl: string): void {
  let url: URL;
  try {
    url = new URL(feedUrl);
  } catch {
    throw new Error("Invalid ICS URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("ICS feed must use HTTPS");
  }
  const host = url.hostname.toLowerCase();
  /** Google Calendar “secret address in iCal format” (Option A in setup). */
  const allowedGoogleCalendar = host === "calendar.google.com";
  const allowedDefault =
    allowedGoogleCalendar ||
    host === "instructure.com" ||
    host.endsWith(".instructure.com") ||
    host.endsWith(".canvaslms.com");
  const allowedExtra = extraAllowedHosts().some((entry) => hostMatchesExtra(host, entry));
  if (!allowedDefault && !allowedExtra) {
    throw new Error(
      "ICS host not allowed. Use your school’s Canvas URL (e.g. *.instructure.com), " +
        "a Google Calendar secret iCal URL (calendar.google.com), " +
        "or upload an .ics file you want to add to your schedule."
    );
  }
}

export async function fetchAndParseICS(feedUrl: string): Promise<ParsedVEvent[]> {
  assertCanvasIcsFeedUrlAllowed(feedUrl);
  const res = await fetch(feedUrl, {
    headers: { 'User-Agent': 'Aigenda/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`ICS fetch failed: ${res.status}`);
  }
  const text = await res.text();
  return parseICS(text);
}

export type { ParsedVEvent };
