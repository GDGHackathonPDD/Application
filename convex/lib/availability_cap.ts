/**
 * Minutes the scheduler may place on a calendar day — matches **weekly availability** hours
 * (what the user entered), not a hidden buffer. Feasibility still uses raw claimed hours separately.
 */
export function effectiveMinutesFromAvailableHours(availableHours: number): number {
  if (availableHours <= 0) {
    return 0;
  }
  return Math.round(availableHours * 60);
}
