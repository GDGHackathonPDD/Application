import type {
  Task,
  AvailabilityRow,
  ExpandSuggestion,
  Recommendation,
  FeasibilityPayload,
} from "../types";
import { FEASIBILITY_CONFIG } from "../config";
import { computeOverload } from "./overload";
import { computeFeasibility } from "./availability";
import { eachYmdInRange, parseYmd } from "../calendar_dates";

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

export function buildRecommendations(
  feasibility: { status: string; shortfall_claimed_hours: number; shortfall_capped_hours: number },
  availability: AvailabilityRow[],
  periodStart: string,
  periodEnd: string
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (feasibility.status === 'INFEASIBLE') {
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
  periodEnd: string
): FeasibilityPayload {
  const totalAvail = availability.reduce((s, a) => s + a.available_hours, 0);
  const today = new Date();

  const overload = computeOverload(tasks, totalAvail, today);
  const feasibility = computeFeasibility(tasks, availability, periodStart, periodEnd);
  const recommendations = buildRecommendations(feasibility, availability, periodStart, periodEnd);

  return { overload, feasibility, recommendations };
}
