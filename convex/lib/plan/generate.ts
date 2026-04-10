import type {
  Task,
  AvailabilityRow,
  FeasibilityResult,
  DecompositionStep,
  DriftResult,
  PlanUpdateReason,
  MiniTask,
  PlanBlock,
  PlanDay,
  PlanJson,
} from '../types';
import type { ValidatedPlanJson, ValidatedDecomposition } from './validate';
import { FEASIBILITY_CONFIG } from '../config';
import { computeEffectiveMinutesPerDay } from '../feasibility/availability';
import {
  clampPlanDailyMinutes,
  enforceDeadlineRule,
  DecompositionResultSchema,
  validatePlanJson,
} from './validate';
import { deterministicSchedulerModeA, deterministicSchedulerModeB, type SchedulerInput } from './scheduler';
import { resolvePlanningPeriod } from './period';
import { ApiError } from '../errors';

/** Base URL of repo-root `agent-api/` FastAPI service (local or Cloud Run). */
const AGENT_API_URL = process.env.AGENT_API_URL ?? '';
const AGENT_API_KEY = process.env.AGENT_API_KEY ?? '';

async function callAgentApi<T>(path: string, body: unknown): Promise<T> {
  if (!AGENT_API_URL) {
    throw new ApiError(502, 'Agent API not configured (AGENT_API_URL missing)', 'AGENT_API_UNCONFIGURED');
  }

  const url = `${AGENT_API_URL.replace(/\/+$/, '')}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (AGENT_API_KEY) {
    headers['Authorization'] = `Bearer ${AGENT_API_KEY}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`Agent API ${path} returned ${res.status}:`, text);
    throw new ApiError(502, `Agent API error (${res.status})`, 'AGENT_API_ERROR');
  }

  return res.json() as Promise<T>;
}

function buildParentDueMap(tasks: Task[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of tasks) {
    if (!t.parent_task_id) {
      map.set(t.id, t.due_date);
    }
  }
  return map;
}

function buildEffectiveMinutesMap(
  availability: AvailabilityRow[],
  periodStart: string,
  periodEnd: string
): Record<string, number> {
  const result: Record<string, number> = {};
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    const row = availability.find((a) => a.day_of_week === dow);
    result[dateStr] = computeEffectiveMinutesPerDay(row?.available_hours ?? 0);
  }

  return result;
}

function remainingWorkMinutes(task: Task): number {
  return Math.round(task.estimated_hours * 60 * (1 - task.progress_percent / 100));
}

async function fetchDecompositionForParents(
  tasks: Task[],
  feasibility: FeasibilityResult,
  parentIds: string[]
): Promise<Map<string, DecompositionStep[]>> {
  const stepsMap = new Map<string, DecompositionStep[]>();
  const overallTasks = tasks.filter(
    (t) => !t.parent_task_id && parentIds.includes(t.id) && remainingWorkMinutes(t) > 0
  );
  if (overallTasks.length === 0) return stepsMap;

  try {
    const response = await callAgentApi<{ decompositions: ValidatedDecomposition[] }>(
      '/decompose',
      {
        tasks: overallTasks.map((t) => ({
          parent_task_id: t.id,
          title: t.title,
          due_date: t.due_date,
          remaining_minutes: remainingWorkMinutes(t),
        })),
        feasibility: {
          status: feasibility.status,
          shortfall_hours: feasibility.shortfall_claimed_hours,
        },
      }
    );

    if (response.decompositions) {
      for (const d of response.decompositions) {
        const parsed = DecompositionResultSchema.safeParse(d);
        if (parsed.success) {
          stepsMap.set(parsed.data.parent_task_id, parsed.data.steps);
        }
      }
    }
  } catch (err) {
    console.error('LLM decomposition failed, will use Mode A fallback:', err);
  }

  return stepsMap;
}

async function fetchDecomposition(
  tasks: Task[],
  feasibility: FeasibilityResult
): Promise<Map<string, DecompositionStep[]>> {
  const ids = tasks
    .filter((t) => !t.parent_task_id && remainingWorkMinutes(t) > 0)
    .map((t) => t.id);
  return fetchDecompositionForParents(tasks, feasibility, ids);
}

async function fetchCopy(
  plan: ValidatedPlanJson,
  feasibility: FeasibilityResult,
  driftResult: DriftResult | null,
  updateReason: PlanUpdateReason
): Promise<{ explanation: string; updateSummary: string }> {
  try {
    const response = await callAgentApi<{ explanation: string; updateSummary: string }>(
      '/plan-copy',
      {
        plan_summary: {
          total_blocks: Object.values(plan.days).reduce((s, d) => s + d.blocks.length, 0),
          total_minutes: Object.values(plan.days).reduce(
            (s, d) => s + d.blocks.reduce((bs, b) => bs + b.minutes, 0),
            0
          ),
          period_start: plan.meta.period_start,
          period_end: plan.meta.period_end,
          recovery_mode: plan.meta.recovery_mode,
        },
        feasibility: {
          status: feasibility.status,
          shortfall_hours: feasibility.shortfall_claimed_hours,
        },
        drift: driftResult
          ? { falling_behind: driftResult.falling_behind, reason_codes: driftResult.reason_codes }
          : null,
        update_reason: updateReason,
      }
    );
    return {
      explanation: response.explanation ?? '',
      updateSummary: response.updateSummary ?? '',
    };
  } catch {
    return { explanation: '', updateSummary: '' };
  }
}

export async function generatePlan(
  tasks: Task[],
  availability: AvailabilityRow[],
  feasibility: FeasibilityResult,
  periodStart: string,
  periodEnd: string,
  recoveryMode: boolean,
  driftResult: DriftResult | null,
  updateReason: PlanUpdateReason = 'manual_regenerate'
): Promise<ValidatedPlanJson & { explanation: string; updateSummary: string }> {
  const overallTasks = tasks.filter((t) => !t.parent_task_id);
  const tasksWithRemaining = overallTasks.filter(
    (t) => t.estimated_hours * (1 - t.progress_percent / 100) > 0
  );

  if (tasksWithRemaining.length === 0) {
    throw new ApiError(400, 'No tasks with remaining work to plan', 'NO_REMAINING_WORK');
  }

  let planJson: ValidatedPlanJson;
  let decompositionSteps: Map<string, DecompositionStep[]> = new Map();

  if (recoveryMode) {
    try {
      decompositionSteps = await fetchDecomposition(tasks, feasibility);
    } catch {
      decompositionSteps = new Map();
    }
  }

  if (recoveryMode && decompositionSteps.size > 0) {
    planJson = deterministicSchedulerModeB({
      tasks,
      availability,
      period_start: periodStart,
      period_end: periodEnd,
      recovery_mode: true,
      decompositionSteps,
    }) as ValidatedPlanJson;
  } else {
    planJson = deterministicSchedulerModeA({
      tasks,
      availability,
      period_start: periodStart,
      period_end: periodEnd,
      recovery_mode: recoveryMode,
    }) as ValidatedPlanJson;
  }

  const parentDueMap = buildParentDueMap(tasks);
  planJson = enforceDeadlineRule(planJson, parentDueMap);

  const effectiveMinutes = buildEffectiveMinutesMap(availability, periodStart, periodEnd);
  planJson = clampPlanDailyMinutes(planJson, effectiveMinutes);

  const copy = await fetchCopy(planJson, feasibility, driftResult, updateReason);
  planJson.explanation = copy.explanation;
  planJson.meta.recovery_mode = recoveryMode;

  return { ...planJson, explanation: copy.explanation, updateSummary: copy.updateSummary };
}

function buildReservedMinutesByDayPreserved(
  minis: MiniTask[],
  newTaskId: string
): Record<string, number> {
  const reserved: Record<string, number> = {};
  for (const m of minis) {
    if (m.completed) continue;
    if (m.parent_task_id === newTaskId) continue;
    reserved[m.scheduled_date] = (reserved[m.scheduled_date] ?? 0) + m.minutes;
  }
  return reserved;
}

function preservedBlocksByDay(minis: MiniTask[], newTaskId: string): Record<string, PlanBlock[]> {
  const byDay: Record<string, PlanBlock[]> = {};
  for (const m of minis) {
    if (m.completed) continue;
    if (m.parent_task_id === newTaskId) continue;
    const b: PlanBlock = {
      mini_task_id: m.id,
      parent_task_id: m.parent_task_id,
      title: m.title,
      minutes: m.minutes,
      tier: m.tier,
    };
    if (!byDay[m.scheduled_date]) byDay[m.scheduled_date] = [];
    byDay[m.scheduled_date].push(b);
  }
  return byDay;
}

function mergeIncrementalDays(
  preserved: Record<string, PlanBlock[]>,
  newSubPlanDays: Record<string, { blocks: PlanBlock[] }>
): Record<string, PlanDay> {
  const dates = new Set([...Object.keys(preserved), ...Object.keys(newSubPlanDays)]);
  const out: Record<string, PlanDay> = {};
  for (const d of dates) {
    const a = preserved[d] ?? [];
    const b = newSubPlanDays[d]?.blocks ?? [];
    if (a.length === 0 && b.length === 0) continue;
    out[d] = { blocks: [...a, ...b] };
  }
  return out;
}

export async function incrementalMergeNewTask(
  tasks: Task[],
  availability: AvailabilityRow[],
  feasibility: FeasibilityResult,
  periodStart: string,
  periodEnd: string,
  newTaskId: string,
  preservedIncompleteMinis: MiniTask[]
): Promise<
  ValidatedPlanJson & {
    explanation: string;
    updateSummary: string;
    newMiniTasksPayload: Array<{
      parentTaskId: string;
      title: string;
      scheduledDate: string;
      minutes: number;
      tier: PlanBlock['tier'];
    }>;
  }
> {
  const newTask = tasks.find((t) => t.id === newTaskId && !t.parent_task_id);
  if (!newTask || remainingWorkMinutes(newTask) <= 0) {
    throw new ApiError(400, 'New task has no remaining work to schedule', 'NO_REMAINING_WORK');
  }

  const reserved = buildReservedMinutesByDayPreserved(preservedIncompleteMinis, newTaskId);
  const decompositionSteps = await fetchDecompositionForParents(tasks, feasibility, [newTaskId]);

  const schedulerInput: SchedulerInput = {
    tasks,
    availability,
    period_start: periodStart,
    period_end: periodEnd,
    recovery_mode: true,
    decompositionSteps,
    reservedMinutesByDay: reserved,
    onlyParentTaskIds: [newTaskId],
  };

  let newSubPlan: PlanJson;
  if (decompositionSteps.size > 0) {
    newSubPlan = deterministicSchedulerModeB(schedulerInput);
  } else {
    newSubPlan = deterministicSchedulerModeA(schedulerInput);
  }

  const preservedByDay = preservedBlocksByDay(preservedIncompleteMinis, newTaskId);
  const mergedDays = mergeIncrementalDays(preservedByDay, newSubPlan.days);

  let planJson: ValidatedPlanJson = validatePlanJson({
    version: 1,
    meta: {
      ...newSubPlan.meta,
      period_start: periodStart,
      period_end: periodEnd,
      recovery_mode: decompositionSteps.size > 0,
    },
    explanation: '',
    days: mergedDays,
  });

  const parentDueMap = buildParentDueMap(tasks);
  planJson = enforceDeadlineRule(planJson, parentDueMap);

  const effectiveMinutes = buildEffectiveMinutesMap(availability, periodStart, periodEnd);
  planJson = clampPlanDailyMinutes(planJson, effectiveMinutes);

  const copy = await fetchCopy(planJson, feasibility, null, 'tasks_changed');
  planJson.explanation = copy.explanation;

  const newMiniTasksPayload: Array<{
    parentTaskId: string;
    title: string;
    scheduledDate: string;
    minutes: number;
    tier: PlanBlock['tier'];
  }> = [];

  for (const [date, day] of Object.entries(newSubPlan.days)) {
    for (const block of day.blocks) {
      newMiniTasksPayload.push({
        parentTaskId: block.parent_task_id,
        title: block.title,
        scheduledDate: date,
        minutes: block.minutes,
        tier: block.tier,
      });
    }
  }

  return {
    ...planJson,
    explanation: copy.explanation,
    updateSummary: copy.updateSummary,
    newMiniTasksPayload,
  };
}
