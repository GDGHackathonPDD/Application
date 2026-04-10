import type { DriftResult, DriftChannel, FeasibilityResult, OverloadResult } from "../types";
import { DRIFT_CONFIG } from "../config";

type ChannelInputs = {
  overload: OverloadResult;
  feasibility: FeasibilityResult;
  incompleteBlockCount: number;
  stalledTaskIds: string[];
  overdueDelta: number;
  planCreatedAt: string | null;
  now: Date;
  remainingHoursDelta: number;
  mustDoStreakMiss: number;
};

function overloadOrFeasibility(overload: OverloadResult, feasibility: FeasibilityResult): number {
  let base = 0;
  switch (overload.label) {
    case 'overloaded': base = 0.7; break;
    case 'drifting': base = 0.4; break;
    case 'stable': base = 0; break;
  }
  if (feasibility.status === 'INFEASIBLE') base = Math.max(base, 1.0);
  else if (feasibility.status === 'FEASIBLE_FRAGILE') base = Math.max(base, 0.5);
  return Math.min(1, base);
}

function slippageBlocks(incompleteCount: number): number {
  return Math.min(1, incompleteCount / DRIFT_CONFIG.maxIncompleteBlocks);
}

function stalledProgress(stalledIds: string[]): number {
  return stalledIds.length > 0 ? 1 : 0;
}

function overdueGrowing(delta: number): number {
  return Math.min(1, Math.max(0, delta) / DRIFT_CONFIG.maxOverdueDelta);
}

function scheduleStale(createdAt: string | null, now: Date): number {
  if (!createdAt) return 1;
  const ageMs = now.getTime() - new Date(createdAt).getTime();
  const staleMs = DRIFT_CONFIG.stalePlanDays * 86400000;
  return Math.min(1, ageMs / staleMs);
}

function workDebtRising(delta: number): number {
  return Math.min(1, Math.max(0, delta) / DRIFT_CONFIG.maxRemainingDebtDelta);
}

function mustDoStreakMiss(count: number): number {
  return Math.min(1, count / DRIFT_CONFIG.maxMustDoStreakMiss);
}

export function computeDrift(inputs: ChannelInputs): DriftResult {
  const channels: Record<DriftChannel, number> = {
    OVERLOAD_OR_FEASIBILITY: overloadOrFeasibility(inputs.overload, inputs.feasibility),
    SLIPPAGE_BLOCKS: slippageBlocks(inputs.incompleteBlockCount),
    STALLED_PROGRESS: stalledProgress(inputs.stalledTaskIds),
    OVERDUE_GROWING: overdueGrowing(inputs.overdueDelta),
    SCHEDULE_STALE: scheduleStale(inputs.planCreatedAt, inputs.now),
    WORK_DEBT_RISING: workDebtRising(inputs.remainingHoursDelta),
    MUST_DO_STREAK_MISS: mustDoStreakMiss(inputs.mustDoStreakMiss),
  };

  const w = DRIFT_CONFIG.weights;
  let sumSq = 0;
  const weighted: { channel: DriftChannel; value: number }[] = [];

  for (const [ch, s] of Object.entries(channels)) {
    const weight = w[ch] ?? 0;
    const ws = weight * s;
    sumSq += ws * ws;
    weighted.push({ channel: ch as DriftChannel, value: ws });
  }

  const driftScore = Math.sqrt(sumSq);

  let wNormSq = 0;
  for (const v of Object.values(w)) {
    wNormSq += v * v;
  }
  const driftScoreNorm = wNormSq > 0 ? driftScore / Math.sqrt(wNormSq) : 0;

  const fallingBehind = driftScoreNorm >= DRIFT_CONFIG.thresholdFallingBehind;
  const atRisk = !fallingBehind && driftScoreNorm >= DRIFT_CONFIG.thresholdAtRisk;

  const sorted = weighted.sort((a, b) => b.value - a.value);
  const reasonCodes = sorted
    .filter((x) => x.value > 0)
    .slice(0, DRIFT_CONFIG.topKReasonCodes)
    .map((x) => x.channel);

  const channelScores: Partial<Record<DriftChannel, number>> = {};
  for (const [ch, s] of Object.entries(channels)) {
    if (s > 0) channelScores[ch as DriftChannel] = Math.round(s * 100) / 100;
  }

  return {
    falling_behind: fallingBehind,
    at_risk: atRisk,
    drift_score: Math.round(driftScore * 1000) / 1000,
    drift_score_norm: Math.round(driftScoreNorm * 1000) / 1000,
    reason_codes: reasonCodes,
    channel_scores: channelScores,
  };
}
