import type { Task, AvailabilityRow, PlanJson, PlanBlock, PlanMeta, DecompositionStep } from '../types';
import { FEASIBILITY_CONFIG, SCHEDULER_CONFIG } from '../config';
import { eachYmdInRange, formatYmd, parseYmd } from '../calendar_dates';
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
  /**
   * Parents that had incomplete work scheduled on the calendar day before `period_start` (from
   * stored minis). Listed in priority order — they are scheduled before any other parent.
   */
  carryoverParentIds?: string[];
}

interface DayCapacity {
  date: string;
  effectiveMinutes: number;
}

interface Placement {
  date: string;
  minutes: number;
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

function nextYmd(ymd: string): string {
  const d = parseYmd(ymd);
  d.setDate(d.getDate() + 1);
  return formatYmd(d);
}

function minutesSchedulableAfterWindow(
  task: Task,
  availability: AvailabilityRow[],
  periodEnd: string
): number {
  if (task.due_date <= periodEnd) return 0;
  const start = nextYmd(periodEnd);
  if (start > task.due_date) return 0;

  let total = 0;
  for (const dateStr of eachYmdInRange(start, task.due_date)) {
    const d = parseYmd(dateStr);
    const dow = d.getDay();
    const row = availability.find((a) => a.day_of_week === dow);
    total += computeEffectiveMinutesPerDay(row?.available_hours ?? 0);
  }
  return total;
}

function minutesToScheduleInWindow(
  task: Task,
  availability: AvailabilityRow[],
  periodEnd: string
): number {
  const remaining = remainingMinutes(task);
  if (task.due_date <= periodEnd) return remaining;
  const futureCapacity = minutesSchedulableAfterWindow(task, availability, periodEnd);
  return Math.max(0, remaining - futureCapacity);
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

/**
 * Parent-task schedule order (which task we fully schedule before the next):
 * 1. `plan_sequence` when set (manual tasks).
 * 2. `ics_sequence` — ICS SEQUENCE or file order at sync; lower first within a calendar group.
 * 3. Due → priority → remaining.
 * 4. Title (natural sort) for ties.
 * 5. `created_at`, then `id`.
 */
function compareParentScheduleOrder(a: Task, b: Task): number {
  const sa = a.plan_sequence;
  const sb = b.plan_sequence;
  if (sa != null && sb != null) {
    if (sa !== sb) return sa - sb;
  } else if (sa != null && sb == null) {
    return -1;
  } else if (sa == null && sb != null) {
    return 1;
  }
  const ia = a.ics_sequence ?? 0;
  const ib = b.ics_sequence ?? 0;
  if (ia !== ib) return ia - ib;
  const c = compareSortKey(
    { dueDate: a.due_date, priorityRank: priorityRank(a.priority), remaining: remainingMinutes(a) },
    { dueDate: b.due_date, priorityRank: priorityRank(b.priority), remaining: remainingMinutes(b) }
  );
  if (c !== 0) return c;
  const t = a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
  if (t !== 0) return t;
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function groupMinPlanSequence(tasks: Task[]): number | null {
  let m: number | null = null;
  for (const t of tasks) {
    if (t.plan_sequence != null) {
      if (m == null || t.plan_sequence < m) m = t.plan_sequence;
    }
  }
  return m;
}

function minDueInGroup(tasks: Task[]): string {
  let m = tasks[0].due_date;
  for (const t of tasks) {
    if (t.due_date < m) m = t.due_date;
  }
  return m;
}

function maxPriorityInGroup(tasks: Task[]): number {
  let m = priorityRank(tasks[0].priority);
  for (let i = 1; i < tasks.length; i++) {
    const p = priorityRank(tasks[i].priority);
    if (p > m) m = p;
  }
  return m;
}

/** Which course block runs first: explicit plan_sequence, then soonest due in group, then priority. */
function compareCourseGroups(a: Task[], b: Task[]): number {
  const sa = groupMinPlanSequence(a);
  const sb = groupMinPlanSequence(b);
  if (sa != null && sb != null && sa !== sb) return sa - sb;
  if (sa != null && sb == null) return -1;
  if (sa == null && sb != null) return 1;
  const da = minDueInGroup(a);
  const db = minDueInGroup(b);
  if (da !== db) return da < db ? -1 : 1;
  const pa = maxPriorityInGroup(a);
  const pb = maxPriorityInGroup(b);
  if (pa !== pb) return pb - pa;
  const ida = [...a.map((t) => t.id)].sort()[0]!;
  const idb = [...b.map((t) => t.id)].sort()[0]!;
  return ida < idb ? -1 : ida > idb ? 1 : 0;
}

/** Pull parents that still owe work from “yesterday” to the front of the queue. */
function prioritizeCarryoverParents(tasks: Task[], carryoverParentIds?: string[]): Task[] {
  if (!carryoverParentIds || carryoverParentIds.length === 0) return tasks;
  const seen = new Set<string>();
  const front: Task[] = [];
  for (const id of carryoverParentIds) {
    const t = tasks.find((x) => x.id === id);
    if (t && remainingMinutes(t) > 0) {
      front.push(t);
      seen.add(id);
    }
  }
  const rest = tasks.filter((t) => !seen.has(t.id));
  return [...front, ...rest];
}

/** All tasks sharing `calendar_group_key` are contiguous (one calendar stream before another). */
function orderParentsNoCourseHop(tasks: Task[]): Task[] {
  const buckets = new Map<string, Task[]>();
  for (const t of tasks) {
    const key =
      t.calendar_group_key != null && t.calendar_group_key.length > 0
        ? `g:${t.calendar_group_key}`
        : `single:${t.id}`;
    const arr = buckets.get(key);
    if (arr) arr.push(t);
    else buckets.set(key, [t]);
  }
  const groups = [...buckets.values()];
  groups.sort(compareCourseGroups);
  const out: Task[] = [];
  for (const g of groups) {
    out.push(...[...g].sort(compareParentScheduleOrder));
  }
  return out;
}

function dayCapLeft(
  day: DayCapacity,
  reservedMinutesByDay: Record<string, number> | undefined
): number {
  return Math.max(0, day.effectiveMinutes - (reservedMinutesByDay?.[day.date] ?? 0));
}

/**
 * Minutes to place in one block: up to day capacity and remaining work (no fixed chunk max).
 * Allows a final slice below chunkMin when the whole remainder fits on this day.
 */
function nextBlockMinutes(remaining: number, cap: number): number {
  if (remaining <= 0 || cap <= 0) return 0;
  const place = Math.min(cap, remaining);
  if (place >= SCHEDULER_CONFIG.chunkMin) return place;
  if (remaining <= cap) return remaining;
  return 0;
}

function placeMinutesDayByDay(
  minutes: number,
  days: DayCapacity[],
  capLeftByDay: Map<string, number>,
  scheduledMinutesByDay: Map<string, number>,
  latestPreferredDate?: string
): { placements: Placement[]; remaining: number } {
  let remaining = minutes;
  const placements: Placement[] = [];

  const descendingDays = [...days].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const ascendingDays = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const preferredDays =
    latestPreferredDate == null
      ? descendingDays
      : descendingDays.filter((day) => day.date <= latestPreferredDate);
  const spillDays =
    latestPreferredDate == null
      ? []
      : ascendingDays.filter((day) => day.date > latestPreferredDate);
  const passes =
    latestPreferredDate == null ? [descendingDays] : [preferredDays, spillDays];

  for (const passDays of passes) {
    for (const day of passDays) {
      if (remaining <= 0) break;
      const cap = capLeftByDay.get(day.date) ?? 0;
      const place = nextBlockMinutes(remaining, cap);
      if (place <= 0) continue;
      placements.push({ date: day.date, minutes: place });
      remaining -= place;
      capLeftByDay.set(day.date, cap - place);
      scheduledMinutesByDay.set(
        day.date,
        (scheduledMinutesByDay.get(day.date) ?? 0) + place
      );
    }
    if (remaining <= 0) break;
  }

  return { placements, remaining };
}

function pushBlocksForPlacements(
  planDays: Record<string, { blocks: PlanBlock[] }>,
  placements: Placement[],
  parent_task_id: string,
  titleBase: string,
  planOrderStart = 0
): number {
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
      plan_order: planOrderStart + i,
    });
  }
  return planOrderStart + n;
}

function titlesForPlacements(
  task: Task,
  placements: Placement[],
  decompositionSteps?: Map<string, DecompositionStep[]>
): string[] {
  if (placements.length <= 1) {
    return placements.map(() => task.title);
  }

  const steps = decompositionSteps?.get(task.id) ?? [];
  if (steps.length === 0) {
    return fallbackTitlesForPlacements(task.title, placements.length);
  }

  const rawTitles: string[] = [];
  let placementOffset = 0;
  for (const placement of placements) {
    let stepOffset = 0;
    let title = task.title;
    for (const step of steps) {
      if (placementOffset < stepOffset + step.minutes) {
        title = normalizedMilestoneTitle(step.title, task.title);
        break;
      }
      stepOffset += step.minutes;
    }
    rawTitles.push(title);
    placementOffset += placement.minutes;
  }

  const totals = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const title of rawTitles) {
    totals.set(title, (totals.get(title) ?? 0) + 1);
  }

  if (rawTitles.every((title) => title === task.title)) {
    return fallbackTitlesForPlacements(task.title, placements.length);
  }

  return rawTitles.map((title) => {
    const count = totals.get(title) ?? 0;
    if (count <= 1) return title;
    const nth = (seen.get(title) ?? 0) + 1;
    seen.set(title, nth);
    return `${title} (${nth}/${count})`;
  });
}

function isMeaningfulMilestoneTitle(title: string): boolean {
  const trimmed = title.trim();
  if (trimmed.length < 4) return false;
  if (/^step\s*\d+\b/i.test(trimmed)) return false;
  if (/^part\s*\d+\b/i.test(trimmed)) return false;
  if (/^task\s*\d+\b/i.test(trimmed)) return false;
  if (/^block\s*\d+\b/i.test(trimmed)) return false;
  return true;
}

function normalizedMilestoneTitle(rawTitle: string, fallback: string): string {
  const trimmed = rawTitle.trim();
  if (!isMeaningfulMilestoneTitle(trimmed)) return fallback;
  return trimmed;
}

function fallbackTitlesForPlacements(taskTitle: string, count: number): string[] {
  if (count <= 1) return [taskTitle];
  if (count === 2) return [`Start ${taskTitle}`, `Finish ${taskTitle}`];

  const titles: string[] = [];
  for (let i = 0; i < count; i++) {
    if (i === 0) {
      titles.push(`Start ${taskTitle}`);
    } else if (i === count - 1) {
      titles.push(`Finish ${taskTitle}`);
    } else {
      titles.push(`Continue ${taskTitle} (${i + 1}/${count})`);
    }
  }
  return titles;
}

export function deterministicSchedulerModeA(input: SchedulerInput): PlanJson {
  const {
    tasks,
    availability,
    period_start,
    period_end,
    recovery_mode,
    reservedMinutesByDay,
    onlyParentTaskIds,
    carryoverParentIds,
  } = input;

  const parentFilter = onlyParentTaskIds;
  const overallTasks = prioritizeCarryoverParents(
    orderParentsNoCourseHop(
      tasks
        .filter((t) => !t.parent_task_id && remainingMinutes(t) > 0)
        .filter((t) => !parentFilter || parentFilter.includes(t.id))
    ),
    carryoverParentIds
  );

  const days = getDayCapacities(availability, period_start, period_end);
  const planDays: Record<string, { blocks: PlanBlock[] }> = {};
  const unscheduled: Record<string, number> = {};
  const parentOrder = new Map<string, number>(overallTasks.map((task, i) => [task.id, i]));

  const capLeftByDay = new Map<string, number>();
  const scheduledMinutesByDay = new Map<string, number>();
  for (const day of days) {
    planDays[day.date] = { blocks: [] };
    capLeftByDay.set(day.date, dayCapLeft(day, reservedMinutesByDay));
    scheduledMinutesByDay.set(day.date, 0);
  }

  for (const task of overallTasks) {
    const { placements, remaining } = placeMinutesDayByDay(
      minutesToScheduleInWindow(task, availability, period_end),
      days,
      capLeftByDay,
      scheduledMinutesByDay,
      task.due_date >= period_start ? task.due_date : undefined
    );
    placements.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    pushBlocksForPlacements(planDays, placements, task.id, task.title);
    if (remaining > 0) unscheduled[task.id] = remaining;
  }

  for (const day of Object.values(planDays)) {
    day.blocks.sort((a, b) => {
      const parentCmp =
        (parentOrder.get(a.parent_task_id) ?? Number.MAX_SAFE_INTEGER) -
        (parentOrder.get(b.parent_task_id) ?? Number.MAX_SAFE_INTEGER);
      if (parentCmp !== 0) return parentCmp;
      return (a.plan_order ?? 0) - (b.plan_order ?? 0);
    });
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

/**
 * Mode B is selected when the agent returned decomposition steps for copy/context.
 * It still uses the same day-by-day fill rule as Mode A, but preserves step titles from the
 * decomposition so segmented work shows the LLM-provided names instead of generic block labels.
 */
export function deterministicSchedulerModeB(input: SchedulerInput): PlanJson {
  const {
    tasks,
    availability,
    period_start,
    period_end,
    recovery_mode,
    reservedMinutesByDay,
    onlyParentTaskIds,
    carryoverParentIds,
    decompositionSteps,
  } = input;

  const parentFilter = onlyParentTaskIds;
  const overallTasks = prioritizeCarryoverParents(
    orderParentsNoCourseHop(
      tasks
        .filter((t) => !t.parent_task_id && remainingMinutes(t) > 0)
        .filter((t) => !parentFilter || parentFilter.includes(t.id))
    ),
    carryoverParentIds
  );

  const days = getDayCapacities(availability, period_start, period_end);
  const planDays: Record<string, { blocks: PlanBlock[] }> = {};
  const unscheduled: Record<string, number> = {};
  const parentOrder = new Map<string, number>(overallTasks.map((task, i) => [task.id, i]));

  const capLeftByDay = new Map<string, number>();
  const scheduledMinutesByDay = new Map<string, number>();
  for (const day of days) {
    planDays[day.date] = { blocks: [] };
    capLeftByDay.set(day.date, dayCapLeft(day, reservedMinutesByDay));
    scheduledMinutesByDay.set(day.date, 0);
  }

  for (const task of overallTasks) {
    const { placements, remaining } = placeMinutesDayByDay(
      minutesToScheduleInWindow(task, availability, period_end),
      days,
      capLeftByDay,
      scheduledMinutesByDay,
      task.due_date >= period_start ? task.due_date : undefined
    );
    placements.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const titles = titlesForPlacements(task, placements, decompositionSteps);
    for (let i = 0; i < placements.length; i++) {
      const placement = placements[i];
      const title = titles[i] ?? task.title;
      planDays[placement.date].blocks.push({
        mini_task_id: generateMiniTaskId(),
        parent_task_id: task.id,
        title,
        minutes: placement.minutes,
        tier: 'must',
        plan_order: i,
      });
    }

    if (remaining > 0) unscheduled[task.id] = remaining;
  }

  for (const day of Object.values(planDays)) {
    day.blocks.sort((a, b) => {
      const parentCmp =
        (parentOrder.get(a.parent_task_id) ?? Number.MAX_SAFE_INTEGER) -
        (parentOrder.get(b.parent_task_id) ?? Number.MAX_SAFE_INTEGER);
      if (parentCmp !== 0) return parentCmp;
      return (a.plan_order ?? 0) - (b.plan_order ?? 0);
    });
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
