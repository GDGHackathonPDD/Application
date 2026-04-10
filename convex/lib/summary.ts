import type { MiniTask, FeasibilityResult, DriftResult } from './types';
import { ApiError } from './errors';

const AGENT_API_URL = process.env.AGENT_API_URL ?? '';
const AGENT_API_KEY = process.env.AGENT_API_KEY ?? '';

async function callAgentApi<T>(path: string, body: unknown): Promise<T> {
  if (!AGENT_API_URL) {
    throw new ApiError(502, 'Agent API not configured', 'AGENT_API_UNCONFIGURED');
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
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`Agent API ${path} returned ${res.status}:`, text);
    throw new ApiError(502, `Agent API error (${res.status})`, 'AGENT_API_ERROR');
  }

  return res.json() as Promise<T>;
}

interface DailySummaryRequest {
  blocks: {
    title: string;
    minutes: number;
    tier: string;
    completed: boolean;
  }[];
  feasibility_snippet: string;
  drift_context?: {
    falling_behind: boolean;
    reason_codes: string[];
  };
}

interface DailySummaryResponse {
  summary: string;
}

export async function generateDailySummary(
  todayItems: MiniTask[],
  feasibility: FeasibilityResult,
  driftResult?: DriftResult | null
): Promise<string> {
  const mustDos = todayItems.filter((i) => i.tier === 'must' && !i.completed);
  const totalMinutes = todayItems.reduce((s, i) => s + (i.completed ? 0 : i.minutes), 0);

  if (mustDos.length === 0 && totalMinutes === 0) {
    return 'No tasks scheduled for today. Consider regenerating your plan or taking a well-earned break.';
  }

  const feasibilitySnippet =
    feasibility.status === 'INFEASIBLE'
      ? `Infeasible — ${feasibility.shortfall_claimed_hours}h shortfall`
      : feasibility.status === 'FEASIBLE_FRAGILE'
        ? `Fragile — ${feasibility.shortfall_capped_hours}h above sustainable cap`
        : 'Feasible';

  const requestBody: DailySummaryRequest = {
    blocks: todayItems.map((i) => ({
      title: i.title,
      minutes: i.minutes,
      tier: i.tier,
      completed: i.completed,
    })),
    feasibility_snippet: feasibilitySnippet,
    drift_context: driftResult
      ? { falling_behind: driftResult.falling_behind, reason_codes: driftResult.reason_codes }
      : undefined,
  };

  try {
    const response = await callAgentApi<DailySummaryResponse>('/daily-summary', requestBody);
    return response.summary ?? fallbackSummary(mustDos, totalMinutes);
  } catch (err) {
    if (err instanceof ApiError && err.code === 'AGENT_API_UNCONFIGURED') {
      return fallbackSummary(mustDos, totalMinutes);
    }
    console.error('Agent API daily-summary failed, using fallback:', err);
    return fallbackSummary(mustDos, totalMinutes);
  }
}

function fallbackSummary(mustDos: MiniTask[], totalMinutes: number): string {
  const topTask = mustDos[0]?.title ?? 'your top priority task';
  const quickTip = totalMinutes > 30
    ? ` If you only have 30 minutes, start with "${mustDos[0]?.title ?? topTask}".`
    : '';
  return `Focus on ${topTask} today. You have ${totalMinutes} minutes of planned work.${quickTip} You've got this—one block at a time.`;
}
