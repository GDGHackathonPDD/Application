import type { Task, AvailabilityRow, PlanJson, PlanBlock, PlanMeta, DecompositionStep } from '../types';
import { FEASIBILITY_CONFIG, SCHEDULER_CONFIG } from '../config';
import { eachYmdInRange, parseYmd } from '../calendar_dates';
import { computeEffectiveMinutesPerDay } from '../feasibility/availability';

function generateMiniTaskId(): string {
  return crypto.randomUUID();
}

export interface SchedulerInput {
  tasks: Task[];
  availability: AvailabilityRow[];
  period_start: string;
  period_end: string;
  recovery_mode: boolean;
  decompositionSteps?: Map<string, DecompositionStep[]>;
  /** Minutes already committed on a calendar day (e.g. other parents' minis). */
  reservedMinutesByDay?: Record<string, number>;
  /** When set, only these overall tasks are scheduled. */
  onlyParentTaskIds?: string[];
}

interface DayCapacity {
  date: string;
  effectiveMinutes: number;
}

function getDayCapacities(
  availability: AvailabilityRow[],
  periodStart: string,
  periodEnd: string
): DayCapacity[] {
  const dateStrings = eachYmdInRange(periodStart, periodEnd);
  return dateStrings.map((dateStr) => {
    const d = parseYmd(dateStr);
    const dow = d.getDay();
    const row = availability.find((a) => a.day_of_week === dow);
    return {
      date: dateStr,
      effectiveMinutes: computeEffectiveMinutesPerDay(row?.available_hours ?? 0),
    };
  });
}

function isEligible(taskDueDate: string, dayDate: string): boolean {
  return dayDate <= taskDueDate;
}

function remainingMinutes(task: Task): number {
  return Math.round(task.estimated_hours * 60 * (1 - task.progress_percent / 100));
}

type SortKey = { dueDate: string; priorityRank: number; remaining: number };

function priorityRank(p: string): number {
  return p === 'high' ? 3 : p === 'medium' ? 2 : 1;
}

function compareSortKey(a: SortKey, b: SortKey): number {
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  if (a.priorityRank !== b.priorityRank) return b.priorityRank - a.priorityRank;
  return b.remaining - a.remaining;
}

function dayCapLeft(
  day: DayCapacity,
  reservedMinutesByDay: Record<string, number> | undefined
): number {
  return Math.max(0, day.effectiveMinutes - (reservedMinutesByDay?.[day.date] ?? 0));
}

/**
 * Minutes to place in one block: up to schema max, day cap, and remaining work.
 * Allows a final slice below chunkMin when the whole remainder fits on this day.
 */
function nextBlockMinutes(remaining: number, cap: number): number {
  if (remaining <= 0 || cap <= 0) return 0;
  const maxBySchemaAndCap = Math.min(SCHEDULER_CONFIG.chunkMax, cap, remaining);
  if (maxBySchemaAndCap >= SCHEDULER_CONFIG.chunkMin) return maxBySchemaAndCap;
  if (remaining <= cap) return remaining;
  return 0;
}

function pushBlocksForPlacements(
  planDays: Record<string, { blocks: PlanBlock[] }>,
  placements: { date: string; minutes: number }[],
  parent_task_id: string,
  titleBase: string
): void {
  const n = placements.length;
  for (let i = 0; i < n; i++) {
    const p = placements[i];
    const title = n === 1 ? titleBase : `${titleBase} — block ${i + 1}`;
    planDays[p.date].blocks.push({
      mini_task_id: generateMiniTaskId(),
      parent_task_id,
      title,
      minutes: p.minutes,
      tier: 'must',
    });
  }
}

/**
 * Picks eligible day with minimum scheduled load (tie → earlier date).
 */
function pickLeastLoadedDay(
  candidates: { date: string; scheduled: number }[]
): string | null {
  if (candidates.length === 0) return null;
  let best = candidates[0];
  for (const c of candidates) {
    if (c.scheduled < best.scheduled || (c.scheduled === best.scheduled && c.date < best.date)) {
      best = c;
    }
  }
  return best.date;
}

/**
 * Places work for one unit (task or step) in task order:
 * - If the full remainder fits on a single calendar day (capacity-wise), it all goes on one day,
 *   chosen by least scheduled load (spread). Multiple blocks on that day only if schema chunkMax requires it.
 * - Otherwise places one block per iteration on the least-loaded eligible day that can accept work
 *   (no mixing two tasks into 30+30 patterns across days — tasks stay sequential).
 */
function placeMinutesSpreadDays(
  minutes: number,
  dueDate: string,
  days: DayCapacity[],
  capLeftByDay: Map<string, number>,
  scheduledMinutesByDay: Map<string, number>,
  placements: { date: string; minutes: number }[]
): number {
  let remaining = minutes;

  while (remaining > 0) {
    const eligibleDays = days.filter((d) => isEligible(dueDate, d.date));
    const canFitWholeOnOneDay = eligibleDays.some(
      (d) => (capLeftByDay.get(d.date) ?? 0) >= remaining
    );

    if (canFitWholeOnOneDay) {
      const candidates = eligibleDays
        .filter((d) => (capLeftByDay.get(d.date) ?? 0) >= remaining)
        .map((d) => ({
          date: d.date,
          scheduled: scheduledMinutesByDay.get(d.date) ?? 0,
        }));
      const dayDate = pickLeastLoadedDay(candidates);
      if (!dayDate) break;

      let cap = capLeftByDay.get(dayDate) ?? 0;
      let r = remaining;
      while (r > 0) {
        const place = nextBlockMinutes(r, cap);
        if (place <= 0) break;
        placements.push({ date: dayDate, minutes: place });
        r -= place;
        cap -= place;
        capLeftByDay.set(dayDate, cap);
        scheduledMinutesByDay.set(
          dayDate,
          (scheduledMinutesByDay.get(dayDate) ?? 0) + place
        );
      }
      remaining = r;
      if (remaining > 0) continue;
      break;
    }

    const blockCandidates: { date: string; place: number; scheduled: number }[] = [];
    for (const day of eligibleDays) {
      const cap = capLeftByDay.get(day.date) ?? 0;
      const place = nextBlockMinutes(remaining, cap);
      if (place <= 0) continue;
      blockCandidates.push({
        date: day.date,
        place,
        scheduled: scheduledMinutesByDay.get(day.date) ?? 0,
      });
    }
    if (blockCandidates.length === 0) break;

    let best = blockCandidates[0];
    for (const c of blockCandidates) {
      if (c.scheduled < best.scheduled || (c.scheduled === best.scheduled && c.date < best.date)) {
        best = c;
      }
    }

    placements.push({ date: best.date, minutes: best.place });
    remaining -= best.place;
    const newCap = (capLeftByDay.get(best.date) ?? 0) - best.place;
    capLeftByDay.set(best.date, newCap);
    scheduledMinutesByDay.set(
      best.date,
      (scheduledMinutesByDay.get(best.date) ?? 0) + best.place
    );
  }

  return remaining;
}

export function deterministicSchedulerModeA(input: SchedulerInput): PlanJson {
  const { tasks, availability, period_start, period_end, recovery_mode, reservedMinutesByDay, onlyParentTaskIds } =
    input;

  const parentFilter = onlyParentTaskIds;
  const overallTasks = tasks
    .filter((t) => !t.parent_task_id && remainingMinutes(t) > 0)
    .filter((t) => !parentFilter || parentFilter.includes(t.id))
    .sort((a, b) =>
      compareSortKey(
        { dueDate: a.due_date, priorityRank: priorityRank(a.priority), remaining: remainingMinutes(a) },
        { dueDate: b.due_date, priorityRank: priorityRank(b.priority), remaining: remainingMinutes(b) }
      )
    );

  const days = getDayCapacities(availability, period_start, period_end);
  const planDays: Record<string, { blocks: PlanBlock[] }> = {};
  const unscheduled: Record<string, number> = {};

  const capLeftByDay = new Map<string, number>();
  const scheduledMinutesByDay = new Map<string, number>();
  for (const day of days) {
    planDays[day.date] = { blocks: [] };
    capLeftByDay.set(day.date, dayCapLeft(day, reservedMinutesByDay));
    scheduledMinutesByDay.set(day.date, 0);
  }

  for (const task of overallTasks) {
    let remaining = remainingMinutes(task);
    const placements: { date: string; minutes: number }[] = [];
    remaining = placeMinutesSpreadDays(
      remaining,
      task.due_date,
      days,
      capLeftByDay,
      scheduledMinutesByDay,
      placements
    );
    pushBlocksForPlacements(planDays, placements, task.id, task.title);
    if (remaining > 0) unscheduled[task.id] = remaining;
  }

  const meta: PlanMeta = {
    period_start,
    period_end,
    horizon_days: days.length,
    scheduler_version: SCHEDULER_CONFIG.schedulerVersion,
    recovery_mode,
    buffer_minutes_per_day: FEASIBILITY_CONFIG.minBufferMinutes,
    ...(Object.keys(unscheduled).length > 0 ? { unscheduled } : {}),
  };

  return { version: 1, meta, explanation: '', days: planDays };
}

export function deterministicSchedulerModeB(input: SchedulerInput): PlanJson {
  const {
    tasks,
    availability,
    period_start,
    period_end,
    recovery_mode,
    decompositionSteps,
    reservedMinutesByDay,
    onlyParentTaskIds,
  } = input;

  if (!decompositionSteps || decompositionSteps.size === 0) {
    return deterministicSchedulerModeA(input);
  }

  const parentFilter = onlyParentTaskIds;
  const overallTasks = tasks
    .filter((t) => !t.parent_task_id && remainingMinutes(t) > 0)
    .filter((t) => !parentFilter || parentFilter.includes(t.id))
    .sort((a, b) =>
      compareSortKey(
        { dueDate: a.due_date, priorityRank: priorityRank(a.priority), remaining: remainingMinutes(a) },
        { dueDate: b.due_date, priorityRank: priorityRank(b.priority), remaining: remainingMinutes(b) }
      )
    );

  const days = getDayCapacities(availability, period_start, period_end);
  const planDays: Record<string, { blocks: PlanBlock[] }> = {};
  const unscheduled: Record<string, number> = {};

  const capLeftByDay = new Map<string, number>();
  const scheduledMinutesByDay = new Map<string, number>();
  for (const day of days) {
    planDays[day.date] = { blocks: [] };
    capLeftByDay.set(day.date, dayCapLeft(day, reservedMinutesByDay));
    scheduledMinutesByDay.set(day.date, 0);
  }

  for (const task of overallTasks) {
    const steps = decompositionSteps.get(task.id) ?? [];
    for (let si = 0; si < steps.length; si++) {
      const step = steps[si];
      const placements: { date: string; minutes: number }[] = [];
      const left = placeMinutesSpreadDays(
        step.minutes,
        task.due_date,
        days,
        capLeftByDay,
        scheduledMinutesByDay,
        placements
      );
      pushBlocksForPlacements(planDays, placements, task.id, step.title);
      if (left > 0) {
        let add = left;
        for (let sj = si + 1; sj < steps.length; sj++) {
          add += steps[sj].minutes;
        }
        unscheduled[task.id] = (unscheduled[task.id] ?? 0) + add;
        break;
      }
    }
  }

  const meta: PlanMeta = {
    period_start,
    period_end,
    horizon_days: days.length,
    scheduler_version: SCHEDULER_CONFIG.schedulerVersion,
    recovery_mode,
    buffer_minutes_per_day: FEASIBILITY_CONFIG.minBufferMinutes,
    ...(Object.keys(unscheduled).length > 0 ? { unscheduled } : {}),
  };

  return { version: 1, meta, explanation: '', days: planDays };
}
