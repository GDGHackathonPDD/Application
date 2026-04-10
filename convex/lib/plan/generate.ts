import type { Task, AvailabilityRow, FeasibilityResult, DecompositionStep, DriftResult, PlanUpdateReason } from '../types';
import type { ValidatedPlanJson, ValidatedDecomposition } from './validate';
import { FEASIBILITY_CONFIG } from '../config';
import { computeEffectiveMinutesPerDay } from '../feasibility/availability';
import { clampPlanDailyMinutes, enforceDeadlineRule, DecompositionResultSchema } from './validate';
import { deterministicSchedulerModeA, deterministicSchedulerModeB } from './scheduler';
import { resolvePlanningPeriod } from './period';
import { ApiError } from '../errors';

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

async function fetchDecomposition(
  tasks: Task[],
  feasibility: FeasibilityResult
): Promise<Map<string, DecompositionStep[]>> {
  const stepsMap = new Map<string, DecompositionStep[]>();
  const overallTasks = tasks.filter((t) => !t.parent_task_id);

  for (const task of overallTasks) {
    const rem = task.estimated_hours * 60 * (1 - task.progress_percent / 100);
    if (rem <= 0) continue;

    try {
      const response = await callAgentApi<{ decompositions: ValidatedDecomposition[] }>(
        '/decompose',
        {
          tasks: overallTasks
            .filter((t) => t.estimated_hours * 60 * (1 - t.progress_percent / 100) > 0)
            .map((t) => ({
              parent_task_id: t.id,
              title: t.title,
              due_date: t.due_date,
              remaining_minutes: Math.round(t.estimated_hours * 60 * (1 - t.progress_percent / 100)),
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
      break;
    } catch (err) {
      console.error('LLM decomposition failed, will use Mode A fallback:', err);
      return stepsMap;
    }
  }

  return stepsMap;
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
