import { z } from 'zod';

import { PLAN_BLOCK_MINUTES_MAX, SCHEDULER_CONFIG } from '../config';

export const PlanBlockSchema = z.object({
  mini_task_id: z.string(),
  parent_task_id: z.string(),
  title: z.string().max(200),
  minutes: z.number().int().min(5).max(PLAN_BLOCK_MINUTES_MAX),
  tier: z.enum(['must', 'should', 'optional']),
  plan_order: z.number().int().min(0).optional(),
});

export const PlanDaySchema = z.object({
  available_hours: z.number().optional(),
  blocks: z.array(PlanBlockSchema),
});

export const PlanMetaSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horizon_days: z.number().int().optional(),
  scheduler_version: z.string(),
  recovery_mode: z.boolean(),
  buffer_minutes_per_day: z.number().optional(),
  unscheduled: z.record(z.string(), z.number()).optional(),
});

export const PlanJsonSchema = z.object({
  version: z.literal(1),
  meta: PlanMetaSchema,
  explanation: z.string().max(2000),
  days: z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), PlanDaySchema),
});

export type ValidatedPlanJson = z.infer<typeof PlanJsonSchema>;

export function clampPlanDailyMinutes(
  plan: ValidatedPlanJson,
  effectiveMinutesPerDay: Record<string, number>
): ValidatedPlanJson {
  const clamped = { ...plan, days: { ...plan.days } };

  for (const [date, day] of Object.entries(clamped.days)) {
    const cap = effectiveMinutesPerDay[date] ?? 480;
    let total = 0;
    const clampedBlocks = day.blocks.map((block) => {
      const remaining = cap - total;
      if (remaining <= 0) return null;
      const adjustedMinutes = Math.min(block.minutes, remaining);
      total += adjustedMinutes;
      return { ...block, minutes: adjustedMinutes };
    });

    const nonNull = clampedBlocks.filter((b): b is NonNullable<typeof b> => b !== null);
    // Drop sub-chunk leftovers that violate PlanBlockSchema (minutes floor).
    const valid = nonNull.filter((b) => b.minutes >= SCHEDULER_CONFIG.chunkMin);

    clamped.days[date] = {
      ...day,
      blocks: valid,
    };
  }

  return clamped;
}

/** Pass-through: scheduler may place work after due to finish parent A before scheduling parent B. */
export function enforceDeadlineRule(
  plan: ValidatedPlanJson,
  _parentDueDates: Map<string, string>
): ValidatedPlanJson {
  return plan;
}

export function validatePlanJson(raw: unknown): ValidatedPlanJson {
  return PlanJsonSchema.parse(raw);
}

export const DecompositionStepSchema = z.object({
  title: z.string().min(1).max(200),
  minutes: z.number().int().min(5).max(PLAN_BLOCK_MINUTES_MAX),
});

export const DecompositionResultSchema = z.object({
  parent_task_id: z.string(),
  steps: z.array(DecompositionStepSchema).min(1),
});

export type ValidatedDecomposition = z.infer<typeof DecompositionResultSchema>;
