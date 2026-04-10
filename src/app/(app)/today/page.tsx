"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@convex/_generated/api";

import { TodayScreen } from "@/components/momentum/today-screen";
import { useConvexProvisioned } from "@/components/convex-provision-context";
import { convexMiniToUi, mapDashboardToMomentum } from "@/lib/convex-to-momentum";
import type { MiniTask, OverallTask } from "@/lib/types/momentum";
import { localDateIso } from "@/lib/local-date";

function readConvexErrorMessage(e: unknown): string {
  if (e instanceof ConvexError) {
    const d = e.data as { message?: string };
    if (typeof d?.message === "string") return d.message;
  }
  if (e instanceof Error) {
    const m = e.message;
    try {
      const j = JSON.parse(m) as { message?: string };
      if (typeof j?.message === "string") return j.message;
    } catch {
      /* not JSON */
    }
    return m;
  }
  return String(e);
}

function sortOpenMinis(a: MiniTask, b: MiniTask, tasksById: Map<string, { dueDate: string }>) {
  const tierRank: Record<string, number> = { must: 0, should: 1, optional: 2 };
  const da = tasksById.get(a.parentTaskId)?.dueDate ?? "9999-12-31";
  const db = tasksById.get(b.parentTaskId)?.dueDate ?? "9999-12-31";
  if (da !== db) return da.localeCompare(db);
  if (a.scheduledDate !== b.scheduledDate) {
    return a.scheduledDate.localeCompare(b.scheduledDate);
  }
  return (tierRank[a.tier] ?? 9) - (tierRank[b.tier] ?? 9);
}

function sortCheckedMinis(a: MiniTask, b: MiniTask, tasksById: Map<string, { dueDate: string }>) {
  const ta = a.completedAt ?? "";
  const tb = b.completedAt ?? "";
  if (ta !== tb) return tb.localeCompare(ta);
  const da = tasksById.get(a.parentTaskId)?.dueDate ?? "9999-12-31";
  const db = tasksById.get(b.parentTaskId)?.dueDate ?? "9999-12-31";
  return da.localeCompare(db);
}

export default function TodayPage() {
  const { provisioned } = useConvexProvisioned();
  const dashboard = useQuery(api.dashboard.get, provisioned ? {} : "skip");
  const generatePlan = useAction(api.plans.generate);
  const updateChecklist = useMutation(api.checklist.update);
  const [regenerateBusy, setRegenerateBusy] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});

  const dateIso = useMemo(() => localDateIso(), []);

  const { tasks, openMinis, checkedMinis } = useMemo(() => {
    if (!dashboard) {
      return { tasks: [] as OverallTask[], openMinis: [] as MiniTask[], checkedMinis: [] as MiniTask[] };
    }
    const mapped = mapDashboardToMomentum(dashboard);
    const tasksById = new Map(mapped.tasks.map((t) => [t.id, t]));

    const merged: MiniTask[] = dashboard.data.miniTasks.map((d) => {
      const m = convexMiniToUi(d);
      if (Object.prototype.hasOwnProperty.call(optimistic, m.id)) {
        return { ...m, completed: optimistic[m.id]! };
      }
      return m;
    });

    const open = merged.filter((m) => !m.completed).sort((a, b) => sortOpenMinis(a, b, tasksById));
    const checked = merged.filter((m) => m.completed).sort((a, b) => sortCheckedMinis(a, b, tasksById));

    return { tasks: mapped.tasks, openMinis: open, checkedMinis: checked };
  }, [dashboard, optimistic]);

  useEffect(() => {
    if (!dashboard) return;
    setOptimistic((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const id of Object.keys(next)) {
        const row = dashboard.data.miniTasks.find((x) => x.id === id);
        if (row && row.completed === next[id]) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [dashboard]);

  const handleRegeneratePlan = useCallback(async () => {
    setRegenerateError(null);
    setRegenerateBusy(true);
    try {
      /** Recovery replan: ~60m blocks (Mode A) or agent steps (Mode B). */
      await generatePlan({ period_start: localDateIso(), recovery_mode: true });
    } catch (e) {
      setRegenerateError(readConvexErrorMessage(e));
    } finally {
      setRegenerateBusy(false);
    }
  }, [generatePlan]);

  const handleToggleComplete = useCallback(
    async (miniTaskId: string, completed: boolean) => {
      setOptimistic((prev) => ({ ...prev, [miniTaskId]: completed }));
      try {
        await updateChecklist({ id: miniTaskId, completed });
      } catch {
        setOptimistic((prev) => {
          const next = { ...prev };
          delete next[miniTaskId];
          return next;
        });
      }
    },
    [updateChecklist]
  );

  if (!provisioned || dashboard === undefined) {
    return (
      <div className="text-muted-foreground animate-pulse text-sm">Loading today…</div>
    );
  }

  return (
    <TodayScreen
      dateIso={dateIso}
      tasks={tasks}
      openMinis={openMinis}
      checkedMinis={checkedMinis}
      onToggleComplete={handleToggleComplete}
      onRegeneratePlan={handleRegeneratePlan}
      regenerateBusy={regenerateBusy}
      regenerateError={regenerateError}
    />
  );
}
