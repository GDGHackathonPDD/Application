/**
 * Ordering guarantees: ICS sequence / group, carryover from yesterday, fixture parse.
 * Run: npx tsx scripts/verify-scheduler-order.ts
 * Exit 1 on failure.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseICS } from "../convex/lib/canvas/ics";
import { carryoverParentIdsFromMinis } from "../convex/lib/plan/generate";
import { deterministicSchedulerModeA } from "../convex/lib/plan/scheduler";
import type { AvailabilityRow, MiniTask, Task } from "../convex/lib/types";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

function defaultAvailability(): AvailabilityRow[] {
  const rows: AvailabilityRow[] = [];
  for (let dow = 0; dow <= 6; dow++) {
    rows.push({
      id: `a_${dow}`,
      user_id: "u",
      day_of_week: dow,
      available_hours: 6,
    });
  }
  return rows;
}

function mkTask(
  id: string,
  title: string,
  due: string,
  estH: number,
  opts: { calendar_group_key?: string | null; ics_sequence?: number | null } = {}
): Task {
  const now = new Date().toISOString();
  return {
    id,
    user_id: "u",
    parent_task_id: null,
    title,
    due_date: due,
    estimated_hours: estH,
    priority: "high",
    progress_percent: 0,
    status: "todo",
    color: "#6366f1",
    source: "test",
    external_uid: null,
    scheduled_date: null,
    calendar_group_key: opts.calendar_group_key ?? null,
    ics_sequence: opts.ics_sequence ?? null,
    created_at: now,
    updated_at: now,
  };
}

function uniqueParentOrder(blockParentIds: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of blockParentIds) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function parentIdsOnDay(plan: ReturnType<typeof deterministicSchedulerModeA>, date: string): string[] {
  const day = plan.days[date];
  if (!day) return [];
  return day.blocks.map((b) => b.parent_task_id);
}

function main() {
  const availability = defaultAvailability();
  const periodStart = "2026-04-11";
  const periodEnd = "2026-04-17";

  // 1) Same calendar group: lower ics_sequence first; whole group before ungrouped tasks.
  const tPartI = mkTask("p1", "Due: HW3_part I [MATH2411]", periodEnd, 1, {
    calendar_group_key: "MATH2411",
    ics_sequence: 0,
  });
  const tPart2 = mkTask("p2", "Due: HW3 part2 [MATH2411]", periodEnd, 1, {
    calendar_group_key: "MATH2411",
    ics_sequence: 1,
  });
  const t2352 = mkTask("t2352", "Due: MATH2352 tutorial", periodEnd, 1, {
    calendar_group_key: null,
    ics_sequence: 0,
  });
  let plan = deterministicSchedulerModeA({
    tasks: [tPart2, t2352, tPartI],
    availability,
    period_start: periodStart,
    period_end: periodEnd,
    recovery_mode: false,
  });
  const firstOrder = uniqueParentOrder(parentIdsOnDay(plan, periodEnd));
  assert(
    firstOrder.length === 3 && firstOrder[0] === "p1" && firstOrder[1] === "p2" && firstOrder[2] === "t2352",
    `expected parent order p1 → p2 → t2352 on ${periodEnd}, got ${firstOrder.join(",")}`
  );

  // 2) Carryover: incomplete minis on the day before period_start run first.
  const t2351 = mkTask("t2351", "MATH2351 Tutorial", periodEnd, 1, {
    calendar_group_key: "MATH2351",
    ics_sequence: 0,
  });
  const t2352b = mkTask("t2352b", "MATH2352 other", periodEnd, 1, {
    calendar_group_key: "MATH2352",
    ics_sequence: 0,
  });
  const minis: MiniTask[] = [
    {
      id: "m1",
      user_id: "u",
      parent_task_id: "t2351",
      plan_id: null,
      title: "block",
      scheduled_date: "2026-04-12",
      minutes: 60,
      tier: "must",
      completed: false,
      completed_at: null,
      plan_order: 0,
    },
  ];
  const tasks2: Task[] = [t2352b, t2351];
  const co = carryoverParentIdsFromMinis("2026-04-13", minis, tasks2);
  assert(co[0] === "t2351", `carryover list should start with t2351, got ${co.join(",")}`);
  plan = deterministicSchedulerModeA({
    tasks: tasks2,
    availability,
    period_start: "2026-04-13",
    period_end: periodEnd,
    recovery_mode: false,
    carryoverParentIds: co,
  });
  const day17 = uniqueParentOrder(parentIdsOnDay(plan, periodEnd));
  assert(day17[0] === "t2351", `first parent on ${periodEnd} should be t2351, got ${day17.join(",")}`);

  // 3) Fixture: HW3 part I SEQUENCE 0, part2 SEQUENCE 1 (part I sorts first).
  const fixturePath = resolve(process.cwd(), "tests/fixtures/homework-sample.ics");
  const parsed = parseICS(readFileSync(fixturePath, "utf8"));
  const part2 = parsed.find((e) => e.uid === "hw3-part2@test");
  const part1 = parsed.find((e) => e.uid === "hw3-part1-math2411@test");
  assert(part1?.icsSequence === 0 && part2?.icsSequence === 1, "fixture SEQUENCE 0/1 for part I / part2");

  console.log("OK: verify-scheduler-order — group+ics_sequence, carryover, ICS SEQUENCE parse.");
}

main();
