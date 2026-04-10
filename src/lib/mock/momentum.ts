import type {
  CanvasSyncState,
  FeasibilityPayload,
  MiniTask,
  OverallTask,
  UserPlan,
  WeeklyAvailability,
} from "@/lib/types/momentum"

export const MOCK_TASKS: OverallTask[] = [
  {
    id: "t1",
    title: "Essay — climate policy",
    dueDate: "2026-04-18",
    estimatedHours: 8,
    priority: "high",
    progressPercent: 35,
    color: "#6366f1",
  },
  {
    id: "t2",
    title: "Problem set 4",
    dueDate: "2026-04-14",
    estimatedHours: 4,
    priority: "medium",
    progressPercent: 10,
    color: "#0ea5e9",
    source: "canvas",
  },
  {
    id: "t3",
    title: "Readings week 7",
    dueDate: "2026-04-12",
    estimatedHours: 3,
    priority: "low",
    progressPercent: 0,
    color: "#22c55e",
  },
]

export const MOCK_AVAILABILITY: WeeklyAvailability = {
  mon: 3,
  tue: 2.5,
  wed: 4,
  thu: 2,
  fri: 3,
  sat: 1,
  sun: 0,
}

export const MOCK_FEASIBILITY: FeasibilityPayload = {
  status: "drifting",
  headline: "Your week looks tight — a few hours short of what’s planned.",
  subtext:
    "Remaining work outpaces available hours in this window unless you adjust.",
  remainingHours: 18.5,
  availableHours: 15,
  shortfallHours: 3.5,
  overloadScore: 62,
  suggestions: [
    "Add ~1 h on Wed or Thu.",
    "Move “Problem set 4” due date by one day if your syllabus allows.",
  ],
}

export const MOCK_PLAN: UserPlan = {
  meta: {
    periodStart: "2026-04-10",
    periodEnd: "2026-04-16",
    recoveryMode: false,
  },
  updatedAt: new Date().toISOString(),
  updateReason: "manual_regenerate",
  updateSummary:
    "We tightened the next three days because yesterday’s blocks weren’t completed.",
  days: [
    {
      date: "2026-04-10",
      availableHours: 3,
      scheduledMinutes: 150,
      overallDueTaskIds: [],
      blocks: [
        {
          miniTaskId: "m1",
          parentTaskId: "t1",
          title: "Outline main arguments",
          minutes: 45,
          tier: "must",
        },
        {
          miniTaskId: "m2",
          parentTaskId: "t2",
          title: "Problems 1–2",
          minutes: 60,
          tier: "must",
        },
      ],
    },
    {
      date: "2026-04-11",
      availableHours: 2.5,
      scheduledMinutes: 120,
      overallDueTaskIds: [],
      blocks: [
        {
          miniTaskId: "m3",
          parentTaskId: "t1",
          title: "Draft introduction",
          minutes: 50,
          tier: "should",
        },
      ],
    },
    {
      date: "2026-04-12",
      availableHours: 4,
      scheduledMinutes: 90,
      overallDueTaskIds: ["t3"],
      blocks: [
        {
          miniTaskId: "m4",
          parentTaskId: "t3",
          title: "Skim chapters 4–5",
          minutes: 90,
          tier: "optional",
        },
      ],
    },
    {
      date: "2026-04-13",
      availableHours: 2,
      scheduledMinutes: 60,
      overallDueTaskIds: [],
      blocks: [],
    },
    {
      date: "2026-04-14",
      availableHours: 3,
      scheduledMinutes: 120,
      overallDueTaskIds: ["t2"],
      blocks: [
        {
          miniTaskId: "m5",
          parentTaskId: "t2",
          title: "Problems 3–5",
          minutes: 120,
          tier: "must",
        },
      ],
    },
    {
      date: "2026-04-15",
      availableHours: 3,
      scheduledMinutes: 45,
      overallDueTaskIds: [],
      blocks: [
        {
          miniTaskId: "m6",
          parentTaskId: "t1",
          title: "Revise body paragraphs",
          minutes: 45,
          tier: "should",
        },
      ],
    },
    {
      date: "2026-04-16",
      availableHours: 1,
      scheduledMinutes: 0,
      overallDueTaskIds: [],
      blocks: [],
    },
  ],
}

export const MOCK_MINI_TASKS: MiniTask[] = MOCK_PLAN.days.flatMap((d) =>
  d.blocks.map((b) => ({
    id: b.miniTaskId,
    parentTaskId: b.parentTaskId,
    title: b.title,
    scheduledDate: d.date,
    minutes: b.minutes,
    tier: b.tier,
    completed: false,
  }))
)

export const MOCK_CANVAS: CanvasSyncState = {
  feedUrl: "",
  hasUploadedIcs: false,
  uploadedFileName: null,
  lastSyncedAt: null,
  status: "idle",
}
