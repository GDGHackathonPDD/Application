/**
 * Sanity check: calendar plan must not show blocks whose parent task was removed.
 * Run: pnpm exec tsx scripts/verify-plan-filter.ts
 */
import assert from "node:assert/strict";

import { buildCalendarPlanForWindow } from "../src/lib/momentum/planning-window";
import type { OverallTask, UserPlan, WeeklyAvailability } from "../src/lib/types/momentum";

const avail: WeeklyAvailability = {
  mon: 4,
  tue: 4,
  wed: 4,
  thu: 4,
  fri: 4,
  sat: 4,
  sun: 4,
};

const planWithOrphanBlocks: UserPlan = {
  meta: {
    periodStart: "2026-04-10",
    periodEnd: "2026-04-16",
    recoveryMode: false,
  },
  updatedAt: new Date().toISOString(),
  days: [
    {
      date: "2026-04-10",
      availableHours: 5,
      scheduledMinutes: 60,
      overallDueTaskIds: [],
      blocks: [
        {
          miniTaskId: "mini-1",
          parentTaskId: "gone-task-id",
          title: "Should not appear",
          minutes: 20,
          tier: "must",
        },
      ],
    },
  ],
};

const keptTask: OverallTask = {
  id: "kept-id",
  title: "Still here",
  dueDate: "2026-04-15",
  estimatedHours: 2,
  priority: "medium",
  progressPercent: 0,
  color: "#000",
};

const outEmpty = buildCalendarPlanForWindow(
  planWithOrphanBlocks,
  "2026-04-10",
  "2026-04-10",
  avail,
  []
);
const d0 = outEmpty.days.find((x) => x.date === "2026-04-10");
assert(d0, "day missing");
assert.equal(d0.blocks.length, 0);
assert.equal(d0.scheduledMinutes, 0);

const planMixed: UserPlan = {
  ...planWithOrphanBlocks,
  days: [
    {
      ...planWithOrphanBlocks.days[0]!,
      blocks: [
        ...planWithOrphanBlocks.days[0]!.blocks,
        {
          miniTaskId: "mini-2",
          parentTaskId: "kept-id",
          title: "Keep",
          minutes: 30,
          tier: "must",
        },
      ],
      scheduledMinutes: 90,
    },
  ],
};

const outKept = buildCalendarPlanForWindow(planMixed, "2026-04-10", "2026-04-10", avail, [keptTask]);
const dk = outKept.days.find((x) => x.date === "2026-04-10");
assert(dk && dk.blocks.length === 1);
assert.equal(dk.blocks[0]!.parentTaskId, "kept-id");
assert.equal(dk.scheduledMinutes, 30);

console.log("verify-plan-filter: ok");
