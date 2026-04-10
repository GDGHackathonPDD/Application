"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

import { AppLoadingLogo } from "@/components/app-loading-logo";
import { DashboardClient } from "@/components/momentum/dashboard-client";
import { useConvexProvisioned } from "@/components/convex-provision-context";
import { mapDashboardToMomentum } from "@/lib/convex-to-momentum";

function DashboardInner() {
  const { provisioned } = useConvexProvisioned();
  const dashboard = useQuery(api.dashboard.get, provisioned ? {} : "skip");

  if (!provisioned || dashboard === undefined) {
    return <AppLoadingLogo label="Loading dashboard…" />;
  }

  const mapped = mapDashboardToMomentum(dashboard);

  return (
    <DashboardClient
      tasks={mapped.tasks}
      plan={mapped.plan}
      feasibility={mapped.feasibility}
      initialMinisByParent={mapped.minisByParent}
      weekAnchor={mapped.anchorDate}
      weeklyAvailability={mapped.weeklyAvailability}
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
