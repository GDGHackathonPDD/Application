export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type Tier = 'must' | 'should' | 'optional';
export type FeasibilityStatus = 'FEASIBLE' | 'FEASIBLE_FRAGILE' | 'INFEASIBLE';
export type OverloadLabel = 'stable' | 'drifting' | 'overloaded';
export type PeriodMode = 'rolling' | 'calendar_month' | 'date_range';
export type PlanUpdateReason =
  | 'initial'
  | 'manual_regenerate'
  | 'auto_drift'
  | 'tasks_changed'
  | 'availability_changed';

export interface User {
  id: string;
  email: string;
  timezone: string;
  default_planning_horizon_days: number;
  default_period_mode: PeriodMode;
  max_auto_horizon_days?: number | null;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  parent_task_id: string | null;
  title: string;
  due_date: string;
  estimated_hours: number;
  priority: Priority;
  progress_percent: number;
  status: TaskStatus;
  color: string | null;
  source: string | null;
  last_source_of_truth: string | null;
  external_uid: string | null;
  /** From ICS sync (`CATEGORIES` or URL); same key → planner keeps one calendar together. */
  calendar_group_key?: string | null;
  merged_key: string | null;
  scheduled_date: string | null;
  /** Overall tasks: lower = scheduled first. Omitted on legacy rows → planner uses due/priority fallback. */
  plan_sequence?: number | null;
  /** ICS SEQUENCE / file order; lower first within `calendar_group_key`. */
  ics_sequence?: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  title: string;
  due_date: string;
  estimated_hours: number;
  priority?: Priority;
  progress_percent?: number;
  status?: TaskStatus;
  color?: string;
  parent_task_id?: string | null;
  source?: string;
  external_uid?: string;
}

export interface UpdateTaskInput {
  title?: string;
  due_date?: string;
  estimated_hours?: number;
  priority?: Priority;
  progress_percent?: number;
  status?: TaskStatus;
  color?: string;
}

export interface MiniTask {
  id: string;
  user_id: string;
  parent_task_id: string;
  plan_id: string | null;
  title: string;
  scheduled_date: string;
  minutes: number;
  tier: Tier;
  completed: boolean;
  completed_at: string | null;
  /** Per parent execution order (matches plan block). Omitted on legacy rows → treat as 0. */
  plan_order?: number;
}

export interface AvailabilityRow {
  id: string;
  user_id: string;
  day_of_week: number;
  available_hours: number;
}

export interface Plan {
  id: string;
  user_id: string;
  plan_json: PlanJson;
  overload_score: number;
  period_start: string | null;
  period_end: string | null;
  horizon_days: number | null;
  update_reason: PlanUpdateReason;
  update_summary: string | null;
  recovery_mode: boolean;
  scheduler_version: string;
  created_at: string;
}

export interface PlanBlock {
  mini_task_id: string;
  parent_task_id: string;
  title: string;
  minutes: number;
  tier: Tier;
  /** Per parent: 0 = first step, 1 = second, … (scheduler and UI use this, not title sort). */
  plan_order?: number;
}

export interface PlanDay {
  available_hours?: number;
  blocks: PlanBlock[];
}

export interface PlanMeta {
  period_start: string;
  period_end: string;
  horizon_days?: number;
  scheduler_version: string;
  recovery_mode: boolean;
  buffer_minutes_per_day?: number;
  unscheduled?: Record<string, number>;
}

export interface PlanJson {
  version: 1;
  meta: PlanMeta;
  explanation: string;
  days: Record<string, PlanDay>;
}

export interface ChecklistItem {
  id: string;
  user_id: string;
  plan_id: string;
  payload_id: string;
  planned_date: string;
  title: string;
  planned_minutes: number;
  tier: Tier;
  completed: boolean;
  completed_at: string | null;
}

export interface DailySummary {
  id: string;
  user_id: string;
  for_date: string;
  summary_text: string;
  sent_at: string | null;
  created_at: string;
}

export interface CanvasICSSettings {
  id: string;
  user_id: string;
  feed_url: string | null;
  /** True when user has uploaded an .ics file (content is not sent to the client). */
  has_uploaded_ics: boolean;
  uploaded_file_name: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
}

export interface OverloadResult {
  score: number;
  label: OverloadLabel;
}

/** Per overall task: remaining work exceeds hours available between window_start and window_end (usually today→due). */
export interface TaskWindowShortfall {
  task_id: string;
  title: string;
  due_date: string;
  remaining_hours: number;
  window_start: string;
  window_end: string;
  available_hours_in_window: number;
  shortfall_hours: number;
  /** Due date is before the planning window start — recovery capacity is only within the horizon. */
  overdue: boolean;
}

export interface FeasibilityResult {
  status: FeasibilityStatus;
  remaining_work_hours: number;
  available_claimed_hours: number;
  available_capped_hours: number;
  shortfall_claimed_hours: number;
  shortfall_capped_hours: number;
  daily_cap_hours: number;
  buffer_ratio: number;
  /** Assignments that cannot fit in available hours from today through due (or horizon if overdue). */
  task_window_shortfalls?: TaskWindowShortfall[];
}

export interface ExpandSuggestion {
  date: string;
  add_hours: number;
  reason: string;
}

export interface Recommendation {
  type: 'EXPAND_HOURS' | 'REDISTRIBUTE' | 'REDUCE_SCOPE';
  message: string;
  suggestions?: ExpandSuggestion[];
}

export interface FeasibilityPayload {
  overload: OverloadResult;
  feasibility: FeasibilityResult;
  recommendations: Recommendation[];
}

export type DriftChannel =
  | 'OVERLOAD_OR_FEASIBILITY'
  | 'SLIPPAGE_BLOCKS'
  | 'STALLED_PROGRESS'
  | 'OVERDUE_GROWING'
  | 'SCHEDULE_STALE'
  | 'WORK_DEBT_RISING'
  | 'MUST_DO_STREAK_MISS';

export interface DriftResult {
  /** True when the full drift norm (all channels) exceeds the threshold. */
  falling_behind: boolean;
  /** True when work-execution channels only exceed the threshold — drives recovery mode and auto_drift. Excludes e.g. schedule staleness. */
  falling_behind_work: boolean;
  at_risk: boolean;
  drift_score: number;
  drift_score_norm: number;
  reason_codes: DriftChannel[];
  channel_scores: Partial<Record<DriftChannel, number>>;
}

export interface PlanningPeriod {
  period_start: string;
  period_end: string;
  horizon_days: number;
}

export interface DecompositionStep {
  title: string;
  minutes: number;
}

export interface DecompositionResult {
  parent_task_id: string;
  steps: DecompositionStep[];
}
