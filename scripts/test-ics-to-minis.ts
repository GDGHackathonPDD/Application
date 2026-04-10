/**
 * Offline test: parse an .ics (Canvas-style), build tasks like sync, run deterministic scheduler.
 * Usage:
 *   npx tsx scripts/test-ics-to-minis.ts
 *   npx tsx scripts/test-ics-to-minis.ts /path/to/your.ics
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseICS, colorForUid } from "../convex/lib/canvas/ics";
import type { Task, AvailabilityRow } from "../convex/lib/types";
import { deterministicSchedulerModeA, deterministicSchedulerModeB } from "../convex/lib/plan/scheduler";
import type { DecompositionStep } from "../convex/lib/types";

function buildTasksFromIcs(text: string): Task[] {
  const events = parseICS(text);
  const userId = "test-user";
  const now = new Date().toISOString();
  const tasks: Task[] = [];
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const dueDate = ev.due ?? ev.dtstart ?? ev.dtend;
    if (!dueDate) continue;
    const id = `task_${ev.uid.replace(/[^a-z0-9]+/gi, "_")}`;
    tasks.push({
      id,
      user_id: userId,
      parent_task_id: null,
      title: ev.summary,
      due_date: dueDate,
      estimated_hours: 3,
      priority: "high",
      progress_percent: 0,
      status: "todo",
      color: colorForUid(ev.uid),
      source: "ics_upload",
      external_uid: ev.uid,
      scheduled_date: null,
      calendar_group_key: ev.calendarGroupKey ?? null,
      ics_sequence: ev.icsSequence !== undefined ? ev.icsSequence : i,
      created_at: now,
      updated_at: now,
    });
  }
  return tasks;
}

/** 6 h Mon–Fri, 2 h Sat–Sun — matches many student setups */
function defaultAvailability(): AvailabilityRow[] {
  const rows: AvailabilityRow[] = [];
  for (let dow = 0; dow <= 6; dow++) {
    const h = dow >= 1 && dow <= 5 ? 6 : 2;
    rows.push({
      id: `avail_${dow}`,
      user_id: "test-user",
      day_of_week: dow,
      available_hours: h,
    });
  }
  return rows;
}

function countBlocks(plan: { days: Record<string, { blocks: unknown[] }> }): number {
  let n = 0;
  for (const day of Object.values(plan.days)) {
    n += day.blocks.length;
  }
  return n;
}

function main() {
  const icsPath = process.argv[2] ?? resolve(process.cwd(), "tests/fixtures/homework-sample.ics");
  const text = readFileSync(icsPath, "utf8");
  const tasks = buildTasksFromIcs(text);
  if (tasks.length === 0) {
    console.error("No tasks parsed from ICS (need UID + SUMMARY + DUE or DTSTART).");
    process.exit(1);
  }

  const periodStart = "2026-04-11";
  const periodEnd = "2026-04-17";
  const availability = defaultAvailability();

  const modeA = deterministicSchedulerModeA({
    tasks,
    availability,
    period_start: periodStart,
    period_end: periodEnd,
    recovery_mode: false,
  });

  const steps = new Map<string, DecompositionStep[]>();
  for (const t of tasks) {
    steps.set(t.id, [
      { title: `${t.title} — step A`, minutes: 60 },
      { title: `${t.title} — step B`, minutes: 60 },
    ]);
  }

  const modeB = deterministicSchedulerModeB({
    tasks,
    availability,
    period_start: periodStart,
    period_end: periodEnd,
    recovery_mode: true,
    decompositionSteps: steps,
  });

  const nA = countBlocks(modeA);
  const nB = countBlocks(modeB);

  console.log(JSON.stringify({
    icsPath,
    parsedTaskCount: tasks.length,
    period: { periodStart, periodEnd },
    modeA_miniBlocks: nA,
    modeB_miniBlocks: nB,
    modeA_sampleDay: modeA.days["2026-04-11"]?.blocks?.length ?? 0,
    pass: nA > 0 && nB > 0,
  }, null, 2));

  if (nA === 0 || nB === 0) {
    console.error("FAIL: scheduler produced zero blocks.");
    process.exit(1);
  }
  console.log("OK: ICS → tasks → deterministic scheduler yields mini-task blocks.");
}

main();
