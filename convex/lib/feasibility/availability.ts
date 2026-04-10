import type {
  Task,
  AvailabilityRow,
  FeasibilityResult,
  FeasibilityStatus,
  TaskWindowShortfall,
} from "../types";
import { FEASIBILITY_CONFIG } from "../config";
import { effectiveMinutesFromAvailableHours } from "../availability_cap";
import { eachYmdInRange, formatYmd, parseYmd } from "../calendar_dates";

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
  return effectiveMinutesFromAvailableHours(availableHours);
}

function maxYmd(a: string, b: string): string {
  return a >= b ? a : b;
}

/**
 * Sum of `available_hours` from the weekly template for each calendar day in [rangeStart, rangeEnd] inclusive.
 */
export function sumAvailableHoursInDateRange(
  availability: AvailabilityRow[],
  rangeStart: string,
  rangeEnd: string
): number {
  if (rangeStart > rangeEnd) return 0;
  let sum = 0;
  for (const dateStr of eachYmdInRange(rangeStart, rangeEnd)) {
    const d = parseYmd(dateStr);
    const dow = d.getDay();
    const row = availability.find((a) => a.day_of_week === dow);
    sum += row?.available_hours ?? 0;
  }
  return sum;
}

/**
 * For each overall task, check whether remaining work fits in available hours from `max(today, periodStart)` through the due date.
 * Overdue tasks use the window `today → periodEnd` (deadline already passed; measures recovery capacity only).
 */
export function computeTaskWindowShortfalls(
  tasks: Task[],
  availability: AvailabilityRow[],
  periodStart: string,
  periodEnd: string,
  todayStr: string
): TaskWindowShortfall[] {
  const out: TaskWindowShortfall[] = [];
  const windowStart = maxYmd(todayStr, periodStart);

  for (const t of tasks) {
    if (t.parent_task_id) continue;
    const r = getRemainingHours(t);
    if (r <= 0) continue;

    const due = t.due_date;
    let windowEnd: string;
    let overdue = false;

    if (due < windowStart) {
      overdue = true;
      windowEnd = periodEnd;
      if (windowStart > periodEnd) {
        out.push({
          task_id: t.id,
          title: t.title,
          due_date: due,
          remaining_hours: Math.round(r * 100) / 100,
          window_start: windowStart,
          window_end: periodEnd,
          available_hours_in_window: 0,
          shortfall_hours: Math.round(r * 100) / 100,
          overdue: true,
        });
        continue;
      }
    } else {
      windowEnd = due;
    }

    const avail = sumAvailableHoursInDateRange(availability, windowStart, windowEnd);
    const shortfall = r - avail;
    if (shortfall > 0.01) {
      out.push({
        task_id: t.id,
        title: t.title,
        due_date: due,
        remaining_hours: Math.round(r * 100) / 100,
        window_start: windowStart,
        window_end: windowEnd,
        available_hours_in_window: Math.round(avail * 100) / 100,
        shortfall_hours: Math.round(shortfall * 100) / 100,
        overdue,
      });
    }
  }

  return out;
}

/**
 * Joint capacity: for each deadline D, total remaining hours of all assignments due on or before D
 * must fit in calendar hours from today through D. (Per-task-only checks miss "4×2h in 3 days".)
 */
export function computeCumulativeDueWindowShortfalls(
  tasks: Task[],
  availability: AvailabilityRow[],
  periodStart: string,
  periodEnd: string,
  todayStr: string
): TaskWindowShortfall[] {
  const out: TaskWindowShortfall[] = [];
  const windowStart = maxYmd(todayStr, periodStart);
  const overall = tasks.filter((t) => !t.parent_task_id && getRemainingHours(t) > 0);
  const uniqueDues = [...new Set(overall.map((t) => t.due_date))].sort();

  for (const D of uniqueDues) {
    const sumRem = overall
      .filter((t) => t.due_date <= D)
      .reduce((s, t) => s + getRemainingHours(t), 0);
    if (sumRem <= 0) continue;

    let windowEnd: string;
    let overdue = false;

    if (D < windowStart) {
      overdue = true;
      windowEnd = periodEnd;
      if (windowStart > periodEnd) {
        out.push({
          task_id: `__cumulative__:${D}`,
          title: `Cumulative (due on or before ${D})`,
          due_date: D,
          remaining_hours: Math.round(sumRem * 100) / 100,
          window_start: windowStart,
          window_end: periodEnd,
          available_hours_in_window: 0,
          shortfall_hours: Math.round(sumRem * 100) / 100,
          overdue: true,
        });
        continue;
      }
    } else {
      windowEnd = D;
    }

    const avail = sumAvailableHoursInDateRange(availability, windowStart, windowEnd);
    const shortfall = sumRem - avail;
    if (shortfall > 0.01) {
      out.push({
        task_id: `__cumulative__:${D}`,
        title: `Cumulative (due on or before ${D})`,
        due_date: D,
        remaining_hours: Math.round(sumRem * 100) / 100,
        window_start: windowStart,
        window_end: windowEnd,
        available_hours_in_window: Math.round(avail * 100) / 100,
        shortfall_hours: Math.round(shortfall * 100) / 100,
        overdue,
      });
    }
  }

  return out;
}

export function computeFeasibility(
  tasks: Task[],
  availability: AvailabilityRow[],
  periodStart: string,
  periodEnd: string,
  todayStr: string = formatYmd(new Date())
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

  const perTaskShortfalls = computeTaskWindowShortfalls(
    tasks,
    availability,
    periodStart,
    periodEnd,
    todayStr
  );
  const overallWithRemaining = tasks.filter((t) => !t.parent_task_id && getRemainingHours(t) > 0);
  const cumulativeShortfalls =
    overallWithRemaining.length >= 2
      ? computeCumulativeDueWindowShortfalls(
          tasks,
          availability,
          periodStart,
          periodEnd,
          todayStr
        )
      : [];
  const task_window_shortfalls = [...perTaskShortfalls, ...cumulativeShortfalls];

  let status: FeasibilityStatus;
  if (W <= A_cap) {
    status = 'FEASIBLE';
  } else if (W <= A_raw) {
    status = 'FEASIBLE_FRAGILE';
  } else {
    status = 'INFEASIBLE';
  }

  if (task_window_shortfalls.length > 0) {
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
    task_window_shortfalls,
  };
}
