import type {
  Task,
  AvailabilityRow,
  FeasibilityResult,
  FeasibilityStatus,
} from "../types";
import { FEASIBILITY_CONFIG, SCHEDULER_CONFIG } from "../config";
import { eachYmdInRange, parseYmd } from "../calendar_dates";

function getRemainingHours(task: Task): number {
  const progress = Math.max(0, Math.min(100, task.progress_percent));
  return task.estimated_hours * (1 - progress / 100);
}

export function computeAvailableHours(
  availability: AvailabilityRow[],
  periodStart: string,
  periodEnd: string
): { claimed: number; capped: number } {
  let claimed = 0;
  let capped = 0;

  for (const dateStr of eachYmdInRange(periodStart, periodEnd)) {
    const d = parseYmd(dateStr);
    const dow = d.getDay();
    const row = availability.find((a) => a.day_of_week === dow);
    const hours = row?.available_hours ?? 0;

    claimed += hours;
    capped += Math.min(hours, FEASIBILITY_CONFIG.dailyCapHours);
  }

  return { claimed, capped };
}

export function computeEffectiveMinutesPerDay(
  availableHours: number
): number {
  if (availableHours <= 0) {
    return 0;
  }
  const raw = availableHours * 60 * (1 - FEASIBILITY_CONFIG.bufferRatio);
  const afterBuffer = Math.max(0, raw - FEASIBILITY_CONFIG.minBufferMinutes);
  // Values like 0.25 h/day become 0 after the fixed buffer and leave the scheduler with no capacity.
  if (afterBuffer === 0 && raw > 0) {
    return Math.max(SCHEDULER_CONFIG.chunkMin, Math.round(raw));
  }
  return afterBuffer;
}

export function computeFeasibility(
  tasks: Task[],
  availability: AvailabilityRow[],
  periodStart: string,
  periodEnd: string
): FeasibilityResult {
  const tasksWithRemaining = tasks.filter((t) => getRemainingHours(t) > 0);

  const relevantTasks = tasksWithRemaining.filter((t) => {
    const due = t.due_date;
    return due <= periodEnd || due < periodStart;
  });

  const W = relevantTasks.reduce((sum, t) => sum + getRemainingHours(t), 0);
  const { claimed: A_raw, capped: A_cap } = computeAvailableHours(
    availability,
    periodStart,
    periodEnd
  );

  const shortfall_claimed = Math.max(0, W - A_raw);
  const shortfall_capped = Math.max(0, W - A_cap);

  let status: FeasibilityStatus;
  if (W <= A_cap) {
    status = 'FEASIBLE';
  } else if (W <= A_raw) {
    status = 'FEASIBLE_FRAGILE';
  } else {
    status = 'INFEASIBLE';
  }

  return {
    status,
    remaining_work_hours: Math.round(W * 100) / 100,
    available_claimed_hours: Math.round(A_raw * 100) / 100,
    available_capped_hours: Math.round(A_cap * 100) / 100,
    shortfall_claimed_hours: Math.round(shortfall_claimed * 100) / 100,
    shortfall_capped_hours: Math.round(shortfall_capped * 100) / 100,
    daily_cap_hours: FEASIBILITY_CONFIG.dailyCapHours,
    buffer_ratio: FEASIBILITY_CONFIG.bufferRatio,
  };
}
