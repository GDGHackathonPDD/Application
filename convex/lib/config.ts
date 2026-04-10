export const FEASIBILITY_CONFIG = {
  dailyCapHours: 4,
  bufferRatio: 0.10,
  minBufferMinutes: 15,
  planningHorizonDays: 7,
  maxPlanningHorizonDays: 45,
  maxDailySuggestionHours: 8,
  largeTaskThresholdHours: 3,
  urgentWindowHours: 72,
} as const;

export const OVERLOAD_BANDS = {
  stable: { min: 0, max: 2 },
  drifting: { min: 3, max: 4 },
  overloaded: { min: 5, max: Infinity },
} as const;

export type OverloadLabel = keyof typeof OVERLOAD_BANDS;

export const SCHEDULER_CONFIG = {
  chunkTarget: 25,
  chunkMin: 15,
  chunkMax: 40,
  chunkTargetRecovery: 20,
  schedulerVersion: 'deterministic-v1',
} as const;

export const DRIFT_CONFIG = {
  weights: {
    OVERLOAD_OR_FEASIBILITY: 1.0,
    SLIPPAGE_BLOCKS: 0.8,
    STALLED_PROGRESS: 0.6,
    OVERDUE_GROWING: 0.7,
    SCHEDULE_STALE: 0.4,
    WORK_DEBT_RISING: 0.6,
    MUST_DO_STREAK_MISS: 0.5,
  } as Record<string, number>,
  thresholdFallingBehind: 0.45,
  thresholdAtRisk: 0.25,
  maxIncompleteBlocks: 6,
  maxOverdueDelta: 3,
  stalePlanDays: 3,
  maxRemainingDebtDelta: 10,
  maxMustDoStreakMiss: 3,
  debounceMinHours: 12,
  topKReasonCodes: 3,
} as const;
