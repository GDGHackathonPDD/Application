import type { Task, AvailabilityRow, PlanJson, PlanBlock, PlanMeta, DecompositionStep } from '../types';
import { FEASIBILITY_CONFIG, SCHEDULER_CONFIG } from '../config';
import { computeEffectiveMinutesPerDay } from '../feasibility/availability';

function generateMiniTaskId(): string {
  return crypto.randomUUID();
}

interface SchedulerInput {
  tasks: Task[];
  availability: AvailabilityRow[];
  period_start: string;
  period_end: string;
  recovery_mode: boolean;
  decompositionSteps?: Map<string, DecompositionStep[]>;
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
  const days: DayCapacity[] = [];
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    const row = availability.find((a) => a.day_of_week === dow);
    days.push({
      date: dateStr,
      effectiveMinutes: computeEffectiveMinutesPerDay(row?.available_hours ?? 0),
    });
  }

  return days;
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

export function deterministicSchedulerModeA(input: SchedulerInput): PlanJson {
  const { tasks, availability, period_start, period_end, recovery_mode } = input;
  const chunkTarget = recovery_mode ? SCHEDULER_CONFIG.chunkTargetRecovery : SCHEDULER_CONFIG.chunkTarget;

  const overallTasks = tasks
    .filter((t) => !t.parent_task_id && remainingMinutes(t) > 0)
    .sort((a, b) => compareSortKey(
      { dueDate: a.due_date, priorityRank: priorityRank(a.priority), remaining: remainingMinutes(a) },
      { dueDate: b.due_date, priorityRank: priorityRank(b.priority), remaining: remainingMinutes(b) }
    ));

  const rem: Map<string, number> = new Map();
  const chunkIndex: Map<string, number> = new Map();
  for (const t of overallTasks) {
    rem.set(t.id, remainingMinutes(t));
    chunkIndex.set(t.id, 0);
  }

  const days = getDayCapacities(availability, period_start, period_end);
  const planDays: Record<string, { blocks: PlanBlock[] }> = {};
  const unscheduled: Record<string, number> = {};

  for (const day of days) {
    planDays[day.date] = { blocks: [] };
    let capLeft = day.effectiveMinutes;

    while (capLeft >= SCHEDULER_CONFIG.chunkMin) {
      const eligible = overallTasks.filter(
        (t) => (rem.get(t.id) ?? 0) > 0 && isEligible(t.due_date, day.date)
      );
      if (eligible.length === 0) break;

      const task = eligible[0];
      const taskRem = rem.get(task.id) ?? 0;
      const chunk = Math.min(chunkTarget, SCHEDULER_CONFIG.chunkMax, capLeft, taskRem);

      if (chunk < SCHEDULER_CONFIG.chunkMin) {
        if (taskRem <= capLeft && taskRem > 0) {
          const idx = (chunkIndex.get(task.id) ?? 0) + 1;
          chunkIndex.set(task.id, idx);
          planDays[day.date].blocks.push({
            mini_task_id: generateMiniTaskId(),
            parent_task_id: task.id,
            title: `${task.title} — block ${idx}`,
            minutes: taskRem,
            tier: 'must',
          });
          capLeft -= taskRem;
          rem.set(task.id, 0);
        } else {
          break;
        }
      } else {
        const idx = (chunkIndex.get(task.id) ?? 0) + 1;
        chunkIndex.set(task.id, idx);
        planDays[day.date].blocks.push({
          mini_task_id: generateMiniTaskId(),
          parent_task_id: task.id,
          title: `${task.title} — block ${idx}`,
          minutes: chunk,
          tier: 'must',
        });
        capLeft -= chunk;
        rem.set(task.id, taskRem - chunk);
      }
    }
  }

  for (const t of overallTasks) {
    const left = rem.get(t.id) ?? 0;
    if (left > 0) unscheduled[t.id] = left;
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
  const { tasks, availability, period_start, period_end, recovery_mode, decompositionSteps } = input;

  if (!decompositionSteps || decompositionSteps.size === 0) {
    return deterministicSchedulerModeA(input);
  }

  const overallTasks = tasks
    .filter((t) => !t.parent_task_id && remainingMinutes(t) > 0)
    .sort((a, b) => compareSortKey(
      { dueDate: a.due_date, priorityRank: priorityRank(a.priority), remaining: remainingMinutes(a) },
      { dueDate: b.due_date, priorityRank: priorityRank(b.priority), remaining: remainingMinutes(b) }
    ));

  interface QueueItem {
    parent_task_id: string;
    parent_due_date: string;
    title: string;
    minutes: number;
    originalMinutes: number;
  }

  const Q: QueueItem[] = [];
  for (const task of overallTasks) {
    const steps = decompositionSteps.get(task.id) ?? [];
    for (const step of steps) {
      Q.push({
        parent_task_id: task.id,
        parent_due_date: task.due_date,
        title: step.title,
        minutes: Math.min(step.minutes, SCHEDULER_CONFIG.chunkMax),
        originalMinutes: step.minutes,
      });
    }
  }

  const days = getDayCapacities(availability, period_start, period_end);
  const planDays: Record<string, { blocks: PlanBlock[] }> = {};
  const unscheduled: Record<string, number> = {};
  const remainingByParent: Map<string, number> = new Map();

  for (const day of days) {
    planDays[day.date] = { blocks: [] };
    let capLeft = day.effectiveMinutes;
    let rotations = 0;
    const maxRotations = Q.length + 1;

    while (capLeft >= SCHEDULER_CONFIG.chunkMin && Q.length > 0 && rotations < maxRotations) {
      const item = Q[0];
      if (!isEligible(item.parent_due_date, day.date)) {
        Q.push(Q.shift()!);
        rotations++;
        continue;
      }

      const use = Math.min(item.minutes, capLeft, SCHEDULER_CONFIG.chunkMax);

      if (use >= SCHEDULER_CONFIG.chunkMin || (item.minutes <= capLeft && item.minutes > 0)) {
        planDays[day.date].blocks.push({
          mini_task_id: generateMiniTaskId(),
          parent_task_id: item.parent_task_id,
          title: item.title,
          minutes: use,
          tier: 'must',
        });
        capLeft -= use;

        if (item.minutes > use) {
          Q[0] = { ...item, minutes: item.minutes - use };
        } else {
          Q.shift();
        }
        rotations = 0;
      } else {
        Q.push(Q.shift()!);
        rotations++;
      }
    }
  }

  for (const item of Q) {
    const prev = remainingByParent.get(item.parent_task_id) ?? 0;
    remainingByParent.set(item.parent_task_id, prev + item.minutes);
  }
  for (const [id, mins] of remainingByParent) {
    if (mins > 0) unscheduled[id] = mins;
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
