export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type Tier = 'must' | 'should' | 'optional';
export type FeasibilityStatus = 'FEASIBLE' | 'FEASIBLE_FRAGILE' | 'INFEASIBLE';
export type OverloadLabel = 'stable' | 'drifting' | 'overloaded';
export type PeriodMode = 'rolling' | 'calendar_month' | 'date_range';
export type PlanUpdateReason = 'initial' | 'manual_regenerate' | 'auto_drift' | 'tasks_changed';

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
  external_uid: string | null;
  scheduled_date: string | null;
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

export interface FeasibilityResult {
  status: FeasibilityStatus;
  remaining_work_hours: number;
  available_claimed_hours: number;
  available_capped_hours: number;
  shortfall_claimed_hours: number;
  shortfall_capped_hours: number;
  daily_cap_hours: number;
  buffer_ratio: number;
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
  falling_behind: boolean;
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
