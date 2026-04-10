interface ParsedVEvent {
  uid: string;
  summary: string;
  dtstart?: string;
  dtend?: string;
  due?: string;
}

/** Parse ICS text into VEVENT summaries (UID + SUMMARY + optional dates). */
export function parseICS(text: string): ParsedVEvent[] {
  const events: ParsedVEvent[] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let inEvent = false;
  let current: Partial<ParsedVEvent> = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      inEvent = false;
      if (current.uid && current.summary) {
        events.push(current as ParsedVEvent);
      }
      continue;
    }
    if (!inEvent) continue;

    if (line.startsWith('UID:')) {
      current.uid = line.slice(4).trim();
    } else if (line.startsWith('SUMMARY:')) {
      current.summary = line.slice(8).trim();
    } else if (line.startsWith('DTSTART') || line.startsWith('DTSTART;')) {
      current.dtstart = extractICSDate(line);
    } else if (line.startsWith('DUE') || line.startsWith('DUE;')) {
      current.due = extractICSDate(line);
    } else if (line.startsWith('DTEND') || line.startsWith('DTEND;')) {
      current.dtend = extractICSDate(line);
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
  const allowedDefault =
    host === "instructure.com" ||
    host.endsWith(".instructure.com") ||
    host.endsWith(".canvaslms.com");
  const allowedExtra = extraAllowedHosts().some((entry) => hostMatchesExtra(host, entry));
  if (!allowedDefault && !allowedExtra) {
    throw new Error(
      "ICS host not allowed. Use your school’s Canvas URL (e.g. *.instructure.com), " +
        "or upload an .ics file you want to add to your schedule."
    );
  }
}

export async function fetchAndParseICS(feedUrl: string): Promise<ParsedVEvent[]> {
  assertCanvasIcsFeedUrlAllowed(feedUrl);
  const res = await fetch(feedUrl, {
    headers: { 'User-Agent': 'MomentumCoach/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`ICS fetch failed: ${res.status}`);
  }
  const text = await res.text();
  return parseICS(text);
}

export type { ParsedVEvent };
