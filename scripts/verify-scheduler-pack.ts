/**
 * Proof script: scheduler places work as late as feasible and keeps unfinished work contiguous.
 * Run: npx tsx scripts/verify-scheduler-pack.ts
 * Exit 1 on any assertion failure.
 */
import { deterministicSchedulerModeA, deterministicSchedulerModeB } from "../convex/lib/plan/scheduler";
import { enforceDeadlineRule } from "../convex/lib/plan/validate";
import type { Task, AvailabilityRow, DecompositionStep } from "../convex/lib/types";

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

function task(
  id: string,
  title: string,
  due: string,
  estH: number,
  progress = 0
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
    progress_percent: progress,
    status: "todo",
    color: "#6366f1",
    source: "test",
    external_uid: null,
    scheduled_date: null,
    created_at: now,
    updated_at: now,
  };
}

function blocksByParent(plan: ReturnType<typeof deterministicSchedulerModeA>): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const [date, day] of Object.entries(plan.days)) {
    for (const b of day.blocks) {
      const list = m.get(b.parent_task_id) ?? [];
      list.push(date);
      m.set(b.parent_task_id, list);
    }
  }
  return m;
}

function main() {
  const availability = defaultAvailability();
  const periodStart = "2026-04-11";
  const periodEnd = "2026-04-17";

  // 1) Single parent 90 min → one block on the latest feasible day
  const t1 = task("a", "HW3 part 2", periodEnd, 1.5);
  let plan = deterministicSchedulerModeA({
    tasks: [t1],
    availability,
    period_start: periodStart,
    period_end: periodEnd,
    recovery_mode: false,
  });
  const dueMap = new Map<string, string>([[t1.id, t1.due_date]]);
  plan = enforceDeadlineRule(plan, dueMap);
  const daysA = blocksByParent(plan).get("a") ?? [];
  assert(daysA.length === 1, `single parent should use 1 calendar day, got ${daysA.join(",")}`);
  const dayBlocks = plan.days[daysA[0]!]?.blocks ?? [];
  assert(dayBlocks.length === 1 && dayBlocks[0]!.minutes === 90, "single parent 90m → one block of 90");
  assert(daysA[0] === periodEnd, `single parent should land on latest day ${periodEnd}, got ${daysA[0]}`);

  // 1b) 2h on one day with plenty of capacity → one block on latest day
  const t1b = task("a2h", "HW3 full", periodEnd, 2);
  plan = deterministicSchedulerModeA({
    tasks: [t1b],
    availability,
    period_start: periodStart,
    period_end: periodEnd,
    recovery_mode: false,
  });
  plan = enforceDeadlineRule(plan, new Map([[t1b.id, t1b.due_date]]));
  const day2h = Object.entries(plan.days).find(([, d]) =>
    d.blocks.some((b) => b.parent_task_id === "a2h")
  );
  assert(!!day2h, "2h parent should schedule");
  const blocks2h = day2h![1].blocks.filter((b) => b.parent_task_id === "a2h");
  assert(
    blocks2h.length === 1 && blocks2h[0]!.minutes === 120,
    `2h parent should be one 120m block, got ${blocks2h.map((b) => b.minutes).join("+")}`
  );
  assert(day2h![0] === periodEnd, `2h parent should use latest day ${periodEnd}, got ${day2h![0]}`);

  // 1c) 4h parent → one block (no artificial chunk cap; limited only by effective day minutes)
  const t4h = task("a4h", "Big HW", periodEnd, 4);
  plan = deterministicSchedulerModeA({
    tasks: [t4h],
    availability,
    period_start: periodStart,
    period_end: periodEnd,
    recovery_mode: false,
  });
  plan = enforceDeadlineRule(plan, new Map([[t4h.id, t4h.due_date]]));
  const day4h = Object.entries(plan.days).find(([, d]) =>
    d.blocks.some((b) => b.parent_task_id === "a4h")
  );
  assert(!!day4h, "4h parent should schedule");
  const blocks4h = day4h![1].blocks.filter((b) => b.parent_task_id === "a4h");
  assert(blocks4h.length === 1, `4h parent should be one block, got ${blocks4h.length}`);

  // 2) Two parents (HW3 part2 read + solve), same due, 20m + 70m → both on latest day
  const read = task("r", "Read HW3 part2 instructions", periodEnd, 20 / 60);
  const solve = task("s", "Solve HW3 part2 problems", periodEnd, 70 / 60);
  plan = deterministicSchedulerModeA({
    tasks: [read, solve],
    availability,
    period_start: periodStart,
    period_end: periodEnd,
    recovery_mode: false,
  });
  const dueMap2 = new Map<string, string>([
    [read.id, read.due_date],
    [solve.id, solve.due_date],
  ]);
  plan = enforceDeadlineRule(plan, dueMap2);
  const dr = blocksByParent(plan).get("r") ?? [];
  const ds = blocksByParent(plan).get("s") ?? [];
  assert(dr.length === 1 && ds.length === 1, "each parent should land on exactly one day");
  assert(dr[0] === ds[0], `both parts should share the same day, got ${dr[0]} vs ${ds[0]}`);
  assert(dr[0] === periodEnd, `latest pack should use last horizon day ${periodEnd}, got ${dr[0]}`);

  // 3) Overdue (due before horizon): schedules on the latest day in the current horizon.
  const overdue = task("o", "Late HW", "2026-04-10", 1);
  plan = deterministicSchedulerModeA({
    tasks: [overdue],
    availability,
    period_start: periodStart,
    period_end: periodEnd,
    recovery_mode: false,
  });
  plan = enforceDeadlineRule(plan, new Map([[overdue.id, overdue.due_date]]));
  const od = blocksByParent(plan).get("o") ?? [];
  assert(od.length >= 1 && od[0] === periodEnd, "overdue task should schedule on the latest horizon day");

  // 4) One assignment spans two calendar days — days must be consecutive and end at the latest day.
  const tSpan = task("span", "Long HW", periodEnd, 12);
  plan = deterministicSchedulerModeA({
    tasks: [tSpan],
    availability,
    period_start: periodStart,
    period_end: periodEnd,
    recovery_mode: false,
  });
  plan = enforceDeadlineRule(plan, new Map([[tSpan.id, tSpan.due_date]]));
  const spanDates = [...new Set(blocksByParent(plan).get("span") ?? [])].sort();
  assert(spanDates.length === 2, `expected work on 2 days, got ${spanDates.join(",")}`);
  const spanStart = new Date(spanDates[0]! + "T12:00:00");
  const spanEnd = new Date(spanDates[1]! + "T12:00:00");
  const deltaDays = Math.round((spanEnd.getTime() - spanStart.getTime()) / 86400000);
  assert(deltaDays === 1, `multi-day homework should be consecutive days, got ${spanDates.join(" → ")}`);
  assert(spanDates[1] === periodEnd, `multi-day homework should finish on latest day ${periodEnd}, got ${spanDates[1]}`);

  // 5) Earlier-due parent must finish before the next parent starts, while later-due work stays late.
  // Mon has tight capacity so m2352 uses Mon then Tue; m2351 stays on Wed.
  const availTightMon: AvailabilityRow[] = [];
  for (let dow = 0; dow <= 6; dow++) {
    availTightMon.push({
      id: `tm_${dow}`,
      user_id: "u",
      day_of_week: dow,
      available_hours: dow === 1 ? 1 : 6,
    });
  }
  const mon = "2026-04-13";
  const tue = "2026-04-14";
  const wed = "2026-04-15";
  const math2352 = task("m2352", "MATH 2352", mon, 1.5);
  const math2351 = task("m2351", "MATH 2351", wed, 1);
  plan = deterministicSchedulerModeA({
    tasks: [math2352, math2351],
    availability: availTightMon,
    period_start: mon,
    period_end: wed,
    recovery_mode: false,
  });
  plan = enforceDeadlineRule(
    plan,
    new Map([
      [math2352.id, math2352.due_date],
      [math2351.id, math2351.due_date],
    ])
  );
  const monBlocks = plan.days[mon]?.blocks ?? [];
  const tueBlocks = plan.days[tue]?.blocks ?? [];
  const wedBlocks = plan.days[wed]?.blocks ?? [];
  assert(
    monBlocks.length > 0 && monBlocks.every((b) => b.parent_task_id === "m2352"),
    "Monday should only contain the first-started parent (2352), not 2351"
  );
  assert(
    tueBlocks.length > 0 && tueBlocks.every((b) => b.parent_task_id === "m2352"),
    "Tuesday should still continue unfinished 2352 before 2351 starts"
  );
  assert(
    wedBlocks.length > 0 && wedBlocks.every((b) => b.parent_task_id === "m2351"),
    "Wednesday should contain 2351 after 2352 has finished"
  );
  const mins2352 =
    Object.values(plan.days).reduce(
      (s, d) => s + d.blocks.filter((b) => b.parent_task_id === "m2352").reduce((a, b) => a + b.minutes, 0),
      0
    ) ?? 0;
  const mins2351 =
    Object.values(plan.days).reduce(
      (s, d) => s + d.blocks.filter((b) => b.parent_task_id === "m2351").reduce((a, b) => a + b.minutes, 0),
      0
    ) ?? 0;
  assert(mins2352 === 90 && mins2351 === 60, "2352 should be fully placed before 2351 consumes capacity");

  // 6) Mode B should only use LLM step titles when the task actually spans multiple placements.
  const availOneHour: AvailabilityRow[] = [];
  for (let dow = 0; dow <= 6; dow++) {
    availOneHour.push({
      id: `oh_${dow}`,
      user_id: "u",
      day_of_week: dow,
      available_hours: 1,
    });
  }
  const llmTask = task("llm", "Write essay", periodEnd, 2);
  const steps = new Map<string, DecompositionStep[]>([
    [
      "llm",
      [
        { title: "Outline argument", minutes: 60 },
        { title: "Draft body paragraphs", minutes: 60 },
      ],
    ],
  ]);
  const planB = deterministicSchedulerModeB({
    tasks: [llmTask],
    availability: availOneHour,
    period_start: periodStart,
    period_end: periodEnd,
    recovery_mode: true,
    decompositionSteps: steps,
  });
  const llmTitles = Object.values(planB.days).flatMap((d) =>
    d.blocks.filter((b) => b.parent_task_id === "llm").map((b) => b.title)
  );
  assert(
    llmTitles.includes("Outline argument") && llmTitles.includes("Draft body paragraphs"),
    `Mode B should preserve LLM step titles, got ${llmTitles.join(",")}`
  );
  const singlePlacementTask = task("single", "Read chapter", periodEnd, 1);
  const singlePlanB = deterministicSchedulerModeB({
    tasks: [singlePlacementTask],
    availability,
    period_start: periodStart,
    period_end: periodEnd,
    recovery_mode: true,
    decompositionSteps: new Map([
      [
        "single",
        [
          { title: "Skim headings", minutes: 30 },
          { title: "Take notes", minutes: 30 },
        ],
      ],
    ]),
  });
  const singleTitles = Object.values(singlePlanB.days).flatMap((d) =>
    d.blocks.filter((b) => b.parent_task_id === "single").map((b) => b.title)
  );
  assert(
    singleTitles.length === 1 && singleTitles[0] === "Read chapter",
    `single placement should keep original title, got ${singleTitles.join(",")}`
  );
  const genericStepsPlan = deterministicSchedulerModeB({
    tasks: [llmTask],
    availability: availOneHour,
    period_start: periodStart,
    period_end: periodEnd,
    recovery_mode: true,
    decompositionSteps: new Map([
      [
        "llm",
        [
          { title: "Step 1", minutes: 60 },
          { title: "Step 3", minutes: 60 },
        ],
      ],
    ]),
  });
  const genericTitles = Object.values(genericStepsPlan.days).flatMap((d) =>
    d.blocks.filter((b) => b.parent_task_id === "llm").map((b) => b.title)
  );
  assert(
    genericTitles[0]?.startsWith("Start Write essay") && genericTitles[1]?.startsWith("Finish Write essay"),
    `generic LLM titles should fall back to meaningful milestones, got ${genericTitles.join(",")}`
  );

  // 7) Near-due work must consume the horizon before far-future work gets mini tasks.
  const shortHorizonAvailability: AvailabilityRow[] = [];
  for (let dow = 0; dow <= 6; dow++) {
    shortHorizonAvailability.push({
      id: `sh_${dow}`,
      user_id: "u",
      day_of_week: dow,
      available_hours: dow === 0 || dow === 6 ? 8 : 5,
    });
  }
  const nearDue = task("near", "Assignment 4c [ELEC4610 (L1)]", "2026-04-12", 2);
  const farDue = task("far", "Part II: Topic 10 - Short-channel MOSFET [ELEC3500 (L1)]", "2026-05-05", 2);
  const shortPlan = deterministicSchedulerModeA({
    tasks: [nearDue, farDue],
    availability: shortHorizonAvailability,
    period_start: "2026-04-11",
    period_end: "2026-04-12",
    recovery_mode: false,
  });
  const nearBlocks = Object.values(shortPlan.days).flatMap((d) =>
    d.blocks.filter((b) => b.parent_task_id === "near").map((b) => b.title)
  );
  const farBlocks = Object.values(shortPlan.days).flatMap((d) =>
    d.blocks.filter((b) => b.parent_task_id === "far").map((b) => b.title)
  );
  assert(nearBlocks.length === 1, `near-due task should be scheduled in short horizon, got ${nearBlocks.length}`);
  assert(farBlocks.length === 0, `far-due task should not steal short-horizon space, got ${farBlocks.length}`);

  console.log(
    "OK: verify-scheduler-pack — latest-feasible placement, consecutive carryover, serial parents, placement-aware LLM titles, near-due priority."
  );
}

main();
