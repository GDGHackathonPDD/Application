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
  /** Preferred block length when slicing work (Mode A fallback, recovery target). */
  chunkTarget: 60,
  chunkMin: 15,
  /** Upper bound per calendar block; must stay within PlanBlockSchema (≤120). */
  chunkMax: 90,
  chunkTargetRecovery: 60,
  /** Sequential tasks; spread across days (least load); one calendar day per task when it fits; no arbitrary fine splits. */
  schedulerVersion: 'deterministic-v5-spread-whole-day',
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
