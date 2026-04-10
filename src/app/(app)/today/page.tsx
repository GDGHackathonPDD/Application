"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

import { AppLoadingLogo } from "@/components/app-loading-logo";
import { TodayScreen } from "@/components/momentum/today-screen";
import { useConvexProvisioned } from "@/components/convex-provision-context";
import { convexMiniToUi, mapDashboardToMomentum } from "@/lib/convex-to-momentum";

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

  if (!provisioned || dashboard === undefined) {
    return <AppLoadingLogo label="Loading today…" />;
  }

  return (
    <TodayScreen dateIso={dateIso} tasks={tasks} todayMinis={todayMinis} />
  );
}
