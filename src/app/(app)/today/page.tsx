"use client";

import { useCallback, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@convex/_generated/api";

import { TodayScreen } from "@/components/momentum/today-screen";
import { useConvexProvisioned } from "@/components/convex-provision-context";
import { convexMiniToUi, mapDashboardToMomentum } from "@/lib/convex-to-momentum";

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

function localDateIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function TodayPage() {
  const { provisioned } = useConvexProvisioned();
  const dashboard = useQuery(api.dashboard.get, provisioned ? {} : "skip");
  const generatePlan = useAction(api.plans.generate);
  const [regenerateBusy, setRegenerateBusy] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const dateIso = useMemo(() => localDateIso(), []);

  const { tasks, todayMinis } = useMemo(() => {
    if (!dashboard) {
      return { tasks: [], todayMinis: [] };
    }
    const mapped = mapDashboardToMomentum(dashboard);
    const minis = dashboard.data.miniTasks
      .filter((m) => m.scheduled_date === dateIso)
      .map(convexMiniToUi);
    return { tasks: mapped.tasks, todayMinis: minis };
  }, [dashboard, dateIso]);

  const handleRegeneratePlan = useCallback(async () => {
    setRegenerateError(null);
    setRegenerateBusy(true);
    try {
      /**
       * `recovery_mode: true` forces Mode B when Agent API returns valid decomposition
       * (segmented mini-task titles from `/decompose`); otherwise deterministic Mode A fallback.
       */
      await generatePlan({ recovery_mode: true });
    } catch (e) {
      setRegenerateError(readConvexErrorMessage(e));
    } finally {
      setRegenerateBusy(false);
    }
  }, [generatePlan]);

  if (!provisioned || dashboard === undefined) {
    return (
      <div className="text-muted-foreground animate-pulse text-sm">Loading today…</div>
    );
  }

  return (
    <TodayScreen
      dateIso={dateIso}
      tasks={tasks}
      initialTodayMinis={todayMinis}
      onRegeneratePlan={handleRegeneratePlan}
      regenerateBusy={regenerateBusy}
      regenerateError={regenerateError}
    />
  );
}
