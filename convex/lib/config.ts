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

/** Hard ceiling for stored plan blocks / minis (no artificial scheduler chunk cap — only safety bound). */
export const PLAN_BLOCK_MINUTES_MAX = 24 * 60;

export const SCHEDULER_CONFIG = {
  /** Preferred block length when slicing work (Mode A fallback, recovery target). */
  chunkTarget: 60,
  chunkMin: 15,
  chunkTargetRecovery: 60,
  /** Sequential tasks; place work as late as feasible while keeping unfinished work first next day. */
  schedulerVersion: 'deterministic-v15-latest-feasible-serial',
} as const;

export const DRIFT_CONFIG = {
  /** Incomplete minis scheduled in [period_start, …] for this many calendar days (inclusive) count toward slippage. */
  slippageWindowDays: 7,
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
