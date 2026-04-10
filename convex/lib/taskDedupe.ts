/**
 * Stable key for matching "same" overall tasks across ICS / Google / manual imports.
 * Normalizes title (trim, collapse whitespace, lowercase) + due date.
 */
export function computeMergedKey(dueDate: string, title: string): string {
  const n = title.trim().replace(/\s+/g, " ").toLowerCase();
  return `${dueDate}::${n}`;
}
