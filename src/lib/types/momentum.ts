/** Domain types aligned with docs/spec-task-model.md and docs/spec-frontend.md */

export type TaskPriority = "low" | "medium" | "high"

export type MiniTaskTier = "must" | "should" | "optional"

export type FeasibilityStatus = "stable" | "drifting" | "infeasible" | "fragile"

export type PlanUpdateReason =
  | "initial"
  | "manual_regenerate"
  | "auto_drift"
  | "tasks_changed"
  | "availability_changed"

export type PlanningPeriodPreset = "7" | "month" | "custom"

export interface OverallTask {
  id: string
  title: string
  dueDate: string
  estimatedHours: number
  priority: TaskPriority
  progressPercent: number
  color: string
  source?: "canvas" | "manual" | "ics"
  /** Last import/sync source that updated this task (ICS, Google, manual). */
  lastSourceOfTruth?: string | null
}

export interface MiniTask {
  id: string
  parentTaskId: string
  title: string
  scheduledDate: string
  minutes: number
  tier: MiniTaskTier
  completed: boolean
  /** ISO timestamp when marked complete; from Convex `completedAt` */
  completedAt?: string | null
  /** Per parent: 0 = do this step first (matches planner block order). */
  planOrder?: number
}

export interface PlanBlockPayload {
  miniTaskId: string
  parentTaskId: string
  title: string
  minutes: number
  tier: MiniTaskTier
  planOrder?: number
}

export interface PlanDay {
  date: string
  availableHours: number
  scheduledMinutes: number
  blocks: PlanBlockPayload[]
  overallDueTaskIds: string[]
}

export interface PlanMeta {
  periodStart: string
  periodEnd: string
  recoveryMode: boolean
}

export interface UserPlan {
  meta: PlanMeta
  days: PlanDay[]
  updatedAt: string
  updateReason?: PlanUpdateReason
  updateSummary?: string
}

export interface TaskWindowShortfallUi {
  title: string
  dueDate: string
  remainingHours: number
  availableHours: number
  shortfallHours: number
  overdue: boolean
}

export interface FeasibilityPayload {
  status: FeasibilityStatus
  headline: string
  subtext: string
  remainingHours: number
  availableHours: number
  shortfallHours?: number
  overloadScore?: number
  suggestions: string[]
  /** Per-assignment: not enough calendar hours from today through due (server `task_window_shortfalls`). */
  taskWindowShortfalls?: TaskWindowShortfallUi[]
}

export interface WeeklyAvailability {
  mon: number
  tue: number
  wed: number
  thu: number
  fri: number
  sat: number
  sun: number
}

export interface CanvasSyncState {
  feedUrl: string
  /** Server has an uploaded .ics (content stays on server). */
  hasUploadedIcs: boolean
  uploadedFileName: string | null
  lastSyncedAt: string | null
  status: "idle" | "syncing" | "error" | "ok"
}
