"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

import { AppLoadingLogo } from "@/components/app-loading-logo";
import { ScheduleScreen } from "@/components/momentum/schedule-screen";
import { useConvexProvisioned } from "@/components/convex-provision-context";
import { mapDashboardToMomentum } from "@/lib/convex-to-momentum";

function ScheduleInner() {
  const { provisioned } = useConvexProvisioned();
  const dashboard = useQuery(api.dashboard.get, provisioned ? {} : "skip");

  if (!provisioned || dashboard === undefined) {
    return <AppLoadingLogo label="Loading schedule…" />;
  }

  const mapped = mapDashboardToMomentum(dashboard);

  return (
    <ScheduleScreen
      tasks={mapped.tasks}
      plan={mapped.plan}
      minisByParent={mapped.minisByParent}
      scheduleAnchor={mapped.anchorDate}
      weeklyAvailability={mapped.weeklyAvailability}
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
