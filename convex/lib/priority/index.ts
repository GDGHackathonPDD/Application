import type { Task } from "../types";

export function computePriorityScore(task: Task, today: Date): number {
  const dueDate = new Date(task.due_date);
  const daysUntilDue = Math.max(0, Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  const isOverdue = dueDate < today;

  const urgencyWeight = 10;
  const impactWeight = 5;

  let urgency: number;
  if (isOverdue) {
    urgency = 100;
  } else if (daysUntilDue === 0) {
    urgency = 90;
  } else if (daysUntilDue <= 3) {
    urgency = 70 - daysUntilDue * 5;
  } else {
    urgency = Math.max(0, 50 - daysUntilDue * 2);
  }

  const priorityMap = { high: 3, medium: 2, low: 1 };
  const priorityValue = priorityMap[task.priority] ?? 2;

  const remainingHours = task.estimated_hours * (1 - task.progress_percent / 100);
  const impact = priorityValue * 10 + Math.min(remainingHours * 2, 20);

  return urgencyWeight * urgency + impactWeight * impact;
}

export function sortTasksByPriority(tasks: Task[], today: Date): Task[] {
  return [...tasks].sort((a, b) => computePriorityScore(b, today) - computePriorityScore(a, today));
}
