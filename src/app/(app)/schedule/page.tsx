"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@convex/_generated/api";

import { AppLoadingLogo } from "@/components/app-loading-logo";
import {
  useDashboardConvexArgs,
  useEffectiveDate,
} from "@/components/effective-date-context";
import { ScheduleScreen } from "@/components/momentum/schedule-screen";
import { useConvexProvisioned } from "@/components/convex-provision-context";
import { mapDashboardToMomentum } from "@/lib/convex-to-momentum";

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

const SCHEDULE_AUTOPLAN_SESSION_KEY = "momentum_schedule_autoplan_v1";

function ScheduleInner() {
  const { provisioned } = useConvexProvisioned();
  const { effectiveDateIso } = useEffectiveDate();
  const dashboardArgs = useDashboardConvexArgs(provisioned);
  const dashboard = useQuery(api.dashboard.get, dashboardArgs);
  const generatePlan = useAction(api.plans.generate);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const autoPlanStarted = useRef(false);

  /** If there is work to plan but no incomplete mini-tasks, run one automatic full replan (once per tab session). */
  useEffect(() => {
    if (!provisioned || dashboard === undefined || !dashboard.success) return;
    if (typeof window !== "undefined" && sessionStorage.getItem(SCHEDULE_AUTOPLAN_SESSION_KEY)) {
      return;
    }
    const overall = dashboard.data.tasks.filter((t) => !t.parent_task_id);
    const hasRemaining = overall.some(
      (t) => t.estimated_hours * (1 - t.progress_percent / 100) > 0
    );
    const incompleteMinis = dashboard.data.miniTasks.filter((m) => !m.completed).length;
    if (!hasRemaining || incompleteMinis > 0 || autoPlanStarted.current) return;

    autoPlanStarted.current = true;
    void (async () => {
      setGenerateBusy(true);
      setGenerateError(null);
      try {
        await generatePlan({ period_start: effectiveDateIso });
        if (typeof window !== "undefined") {
          sessionStorage.setItem(SCHEDULE_AUTOPLAN_SESSION_KEY, "1");
        }
      } catch (e) {
        setGenerateError(readConvexErrorMessage(e));
      } finally {
        setGenerateBusy(false);
      }
    })();
  }, [provisioned, dashboard, generatePlan, effectiveDateIso]);

  const handleGeneratePlan = useCallback(async ({
    periodStart,
    periodEnd,
    preset,
  }: {
    periodStart: string;
    periodEnd: string;
    preset: "7" | "month" | "custom";
  }) => {
    setGenerateError(null);
    setGenerateBusy(true);
    try {
      await generatePlan({
        period_start: periodStart,
        period_end: periodEnd,
        period_mode: preset === "custom" ? "date_range" : preset === "month" ? "calendar_month" : "date_range",
      });
    } catch (e) {
      setGenerateError(readConvexErrorMessage(e));
    } finally {
      setGenerateBusy(false);
    }
  }, [generatePlan]);

  if (!provisioned || dashboard === undefined) {
    return <AppLoadingLogo label="Loading schedule…" />;
  }

  const mapped = mapDashboardToMomentum(dashboard, {
    calendarAnchorYmd: effectiveDateIso,
  });

  return (
    <ScheduleScreen
      tasks={mapped.tasks}
      plan={mapped.plan}
      minisByParent={mapped.minisByParent}
      scheduleAnchor={mapped.anchorDate}
      weeklyAvailability={mapped.weeklyAvailability}
      onGeneratePlan={handleGeneratePlan}
      generateBusy={generateBusy}
      generateError={generateError}
    />
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<AppLoadingLogo label="Loading schedule…" />}>
      <ScheduleInner />
    </Suspense>
  );
}
