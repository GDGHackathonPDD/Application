import type { PeriodMode, PlanningPeriod } from '../types';
import { FEASIBILITY_CONFIG } from '../config';
import { formatYmd, formatYmdInTimeZone, parseYmd } from '../calendar_dates';

export function resolvePlanningPeriod(input: {
  planning_horizon_days?: number;
  period_mode?: PeriodMode;
  period_start?: string;
  period_end?: string;
  /** IANA zone from `users.timezone` so "today" matches the user, not the server clock. */
  userTimeZone?: string;
  userDefaults?: {
    default_planning_horizon_days?: number;
    default_period_mode?: PeriodMode;
    max_auto_horizon_days?: number | null;
  };
  /** When true, `planning_horizon_days` was omitted and rolling horizon comes from profile/defaults — apply max_auto_horizon_days cap. */
  horizonFromDefaultsOnly?: boolean;
  today?: Date;
}): PlanningPeriod {
  const today = input.today ?? new Date();
  const todayStr = input.userTimeZone
    ? formatYmdInTimeZone(input.userTimeZone, today)
    : formatYmd(today);
  const mode = input.period_mode ?? input.userDefaults?.default_period_mode ?? 'rolling';
  const explicitHorizon = input.planning_horizon_days !== undefined;
  let defaultHorizon =
    input.planning_horizon_days ?? input.userDefaults?.default_planning_horizon_days ?? FEASIBILITY_CONFIG.planningHorizonDays;
  if (
    !explicitHorizon &&
    (input.horizonFromDefaultsOnly !== false) &&
    input.userDefaults?.max_auto_horizon_days != null
  ) {
    defaultHorizon = Math.min(defaultHorizon, input.userDefaults.max_auto_horizon_days);
  }

  let periodStart: string = input.period_start ?? todayStr;
  // Never plan in the past: callers may pass an explicit range that starts before today.
  if (parseYmd(periodStart) < parseYmd(todayStr)) {
    periodStart = todayStr;
  }
  let periodEnd: string;
  let horizonDays: number;

  switch (mode) {
    case 'calendar_month': {
      // spec-backend §2.4: today → end of current calendar month (inclusive)
      periodStart = todayStr;
      const start = parseYmd(periodStart);
      const year = start.getFullYear();
      const month = start.getMonth();
      const lastDay = new Date(year, month + 1, 0).getDate();
      periodEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      horizonDays = Math.ceil((parseYmd(periodEnd).getTime() - parseYmd(periodStart).getTime()) / 86400000) + 1;
      break;
    }
    case 'date_range': {
      periodEnd = input.period_end ?? periodStart;
      if (parseYmd(periodEnd) < parseYmd(periodStart)) {
        periodEnd = periodStart;
      }
      const spanDays =
        Math.ceil((parseYmd(periodEnd).getTime() - parseYmd(periodStart).getTime()) / 86400000) + 1;
      if (spanDays > FEASIBILITY_CONFIG.maxPlanningHorizonDays) {
        const end = parseYmd(periodStart);
        end.setDate(end.getDate() + FEASIBILITY_CONFIG.maxPlanningHorizonDays - 1);
        periodEnd = formatYmd(end);
      }
      horizonDays =
        Math.ceil((parseYmd(periodEnd).getTime() - parseYmd(periodStart).getTime()) / 86400000) + 1;
      break;
    }
    case 'rolling':
    default: {
      const horizon = Math.min(defaultHorizon, FEASIBILITY_CONFIG.maxPlanningHorizonDays);
      const end = parseYmd(periodStart);
      end.setDate(end.getDate() + horizon - 1);
      periodEnd = formatYmd(end);
      horizonDays = horizon;
      break;
    }
  }

  if (horizonDays > FEASIBILITY_CONFIG.maxPlanningHorizonDays) {
    const end = parseYmd(periodStart);
    end.setDate(end.getDate() + FEASIBILITY_CONFIG.maxPlanningHorizonDays - 1);
    periodEnd = formatYmd(end);
    horizonDays = FEASIBILITY_CONFIG.maxPlanningHorizonDays;
  }

  return { period_start: periodStart, period_end: periodEnd, horizon_days: horizonDays };
}
