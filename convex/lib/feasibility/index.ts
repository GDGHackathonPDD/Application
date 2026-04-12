import type {
  Task,
  AvailabilityRow,
  ExpandSuggestion,
  Recommendation,
  FeasibilityPayload,
  FeasibilityResult,
} from "../types";
import { FEASIBILITY_CONFIG } from "../config";
import { computeOverload } from "./overload";
import { computeFeasibility } from "./availability";
import { eachYmdInRange, formatYmd, formatYmdInTimeZone, parseYmd } from "../calendar_dates";

function buildExpandSuggestions(
  shortfallHours: number,
  availability: AvailabilityRow[],
  periodStart: string,
  periodEnd: string
): ExpandSuggestion[] {
  const suggestions: ExpandSuggestion[] = [];
  let need = shortfallHours;
  const cap = FEASIBILITY_CONFIG.dailyCapHours;
  const maxDaily = FEASIBILITY_CONFIG.maxDailySuggestionHours;

  const dayEntries: { date: string; available: number }[] = [];
  for (const dateStr of eachYmdInRange(periodStart, periodEnd)) {
    const d = parseYmd(dateStr);
    const dow = d.getDay();
    const row = availability.find((a) => a.day_of_week === dow);
    dayEntries.push({
      date: dateStr,
      available: row?.available_hours ?? 0,
    });
  }

  const sorted = [...dayEntries].sort((a, b) => a.available - b.available);

  for (const day of sorted) {
    if (need <= 0) break;
    const headroom = Math.min(maxDaily, cap * 1.5) - day.available;
    const add = Math.min(Math.max(headroom, 0), need);
    if (add > 0) {
      suggestions.push({
        date: day.date,
        add_hours: Math.round(add * 2) / 2,
        reason: day.available < 1 ? 'Lightest study day' : 'Spread remaining shortfall',
      });
      need -= add;
    }
  }

  if (need > 0) {
    const lastDay = dayEntries[dayEntries.length - 1];
    if (lastDay) {
      suggestions.push({
        date: lastDay.date,
        add_hours: Math.round(need * 2) / 2,
        reason: 'Add remaining hours on last day',
      });
    }
  }

  return suggestions;
}

function taskWindowRecommendationMessages(feasibility: FeasibilityResult): string[] {
  const sf = feasibility.task_window_shortfalls;
  if (!sf || sf.length === 0) return [];
  return sf.map((t) => {
    if (t.task_id.startsWith("__cumulative__:")) {
      const w = t.overdue
        ? `overdue — only ~${t.available_hours_in_window.toFixed(1)} h left in your plan horizon`
        : `~${t.available_hours_in_window.toFixed(1)} h on your calendar from today through that deadline`;
      return `Combined load: ~${t.remaining_hours.toFixed(1)} h of work must finish on or before ${t.due_date}, but there ${w} (short ≈ ${t.shortfall_hours.toFixed(1)} h). Mark items done, reduce estimates, or shift due dates.`;
    }
    const w = t.overdue
      ? `overdue — only ~${t.available_hours_in_window.toFixed(1)} h left in your plan horizon`
      : `~${t.available_hours_in_window.toFixed(1)} h on your calendar before the due date`;
    return `"${t.title}" needs ~${t.remaining_hours.toFixed(1)} h but ${w} (short ≈ ${t.shortfall_hours.toFixed(1)} h). Mark it done if already finished, lower the estimate, or move the deadline.`;
  });
}

export function buildRecommendations(
  feasibility: FeasibilityResult,
  availability: AvailabilityRow[],
  periodStart: string,
  periodEnd: string
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const msg of taskWindowRecommendationMessages(feasibility)) {
    recommendations.push({ type: 'REDUCE_SCOPE', message: msg });
  }

  if (feasibility.status === 'INFEASIBLE' && feasibility.shortfall_claimed_hours > 0.05) {
    const shortfall = feasibility.shortfall_claimed_hours;
    const rounded = Math.ceil(shortfall * 2) / 2;
    const suggestions = buildExpandSuggestions(shortfall, availability, periodStart, periodEnd);

    recommendations.push({
      type: 'EXPAND_HOURS',
      message: `Add about ${rounded} h this week to finish on time.`,
      suggestions,
    });

    recommendations.push({
      type: 'REDUCE_SCOPE',
      message: `Or extend a deadline / drop optional tasks (~${rounded} h).`,
    });
  }

  if (feasibility.status === 'FEASIBLE_FRAGILE') {
    const K = feasibility.shortfall_capped_hours;
    recommendations.push({
      type: 'REDISTRIBUTE',
      message: `Your total hours add up, but days above ${FEASIBILITY_CONFIG.dailyCapHours} h are hard to sustain. Try moving ~${Math.round(K)} hours to lighter days or adding small blocks on low days.`,
    });
  }

  return recommendations;
}

export function computeFeasibilityPayload(
  tasks: Task[],
  availability: AvailabilityRow[],
  periodStart: string,
  periodEnd: string,
  userTimeZone?: string
): FeasibilityPayload {
  const totalAvail = availability.reduce((s, a) => s + a.available_hours, 0);
  const today = new Date();
  const todayStr = userTimeZone
    ? formatYmdInTimeZone(userTimeZone, today)
    : formatYmd(today);

  const feasibility = computeFeasibility(
    tasks,
    availability,
    periodStart,
    periodEnd,
    todayStr
  );
  const taskWindowShortfallCount = feasibility.task_window_shortfalls?.length ?? 0;
  const overload = computeOverload(tasks, totalAvail, today, taskWindowShortfallCount);
  const recommendations = buildRecommendations(feasibility, availability, periodStart, periodEnd);

  return { overload, feasibility, recommendations };
}
