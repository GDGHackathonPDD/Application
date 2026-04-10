import type { Task, OverloadLabel } from "../types";
import { FEASIBILITY_CONFIG, OVERLOAD_BANDS } from "../config";

function getRemainingHours(task: Task): number {
  const progress = Math.max(0, Math.min(100, task.progress_percent));
  return task.estimated_hours * (1 - progress / 100);
}

function hasRemainingWork(task: Task): boolean {
  return getRemainingHours(task) > 0;
}

export function computeOverloadScore(
  tasks: Task[],
  availableHoursTotal: number,
  today: Date
): number {
  let score = 0;

  const remainingTotal = tasks
    .filter(hasRemainingWork)
    .reduce((sum, t) => sum + getRemainingHours(t), 0);

  if (remainingTotal > availableHoursTotal) {
    score += 3;
  }

  const nowMs = today.getTime();
  const urgentThresholdMs = FEASIBILITY_CONFIG.urgentWindowHours * 60 * 60 * 1000;
  const urgentTasks = tasks.filter((t) => {
    if (!hasRemainingWork(t)) return false;
    const dueMs = new Date(t.due_date).getTime();
    const diff = dueMs - nowMs;
    return diff >= 0 && diff <= urgentThresholdMs;
  });
  if (urgentTasks.length >= 3) {
    score += 2;
  }

  const overdueTasks = tasks.filter((t) => {
    if (!hasRemainingWork(t)) return false;
    return new Date(t.due_date) < today;
  });
  if (overdueTasks.length > 0) {
    score += 2;
  }

  const largeUnstarted = tasks.filter((t) => {
    return (
      hasRemainingWork(t) &&
      t.progress_percent === 0 &&
      t.estimated_hours >= FEASIBILITY_CONFIG.largeTaskThresholdHours
    );
  });
  if (largeUnstarted.length >= 2) {
    score += 1;
  }

  return score;
}

export function getOverloadLabel(score: number): OverloadLabel {
  if (score <= OVERLOAD_BANDS.stable.max) return 'stable';
  if (score <= OVERLOAD_BANDS.drifting.max) return 'drifting';
  return 'overloaded';
}

export function computeOverload(
  tasks: Task[],
  availableHoursTotal: number,
  today: Date
) {
  const score = computeOverloadScore(tasks, availableHoursTotal, today);
  return { score, label: getOverloadLabel(score) };
}
