"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

import { AppLoadingLogo } from "@/components/app-loading-logo";
import {
  useDashboardConvexArgs,
  useEffectiveDate,
} from "@/components/effective-date-context";
import { DashboardClient } from "@/components/momentum/dashboard-client";
import { useConvexProvisioned } from "@/components/convex-provision-context";
import { mapDashboardToMomentum } from "@/lib/convex-to-momentum";

function DashboardInner() {
  const { provisioned } = useConvexProvisioned();
  const { effectiveDateIso } = useEffectiveDate();
  const dashboardArgs = useDashboardConvexArgs(provisioned);
  const dashboard = useQuery(api.dashboard.get, dashboardArgs);

  if (!provisioned || dashboard === undefined) {
    return <AppLoadingLogo label="Loading dashboard…" />;
  }

  const mapped = mapDashboardToMomentum(dashboard, {
    calendarAnchorYmd: effectiveDateIso,
  });

  const d = dashboard.data.drift;

  return (
    <DashboardClient
      tasks={mapped.tasks}
      plan={mapped.plan}
      feasibility={mapped.feasibility}
      initialMinisByParent={mapped.minisByParent}
      weekAnchor={mapped.anchorDate}
      weeklyAvailability={mapped.weeklyAvailability}
      drift={{
        fallingBehind: d.falling_behind,
        fallingBehindWork: d.falling_behind_work,
        atRisk: d.at_risk,
      }}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<AppLoadingLogo label="Loading dashboard…" />}>
      <DashboardInner />
    </Suspense>
  );
}
