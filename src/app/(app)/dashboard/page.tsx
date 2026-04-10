"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

import { DashboardClient } from "@/components/momentum/dashboard-client";
import { useConvexProvisioned } from "@/components/convex-provision-context";
import { mapDashboardToMomentum } from "@/lib/convex-to-momentum";

function DashboardInner() {
  const { provisioned } = useConvexProvisioned();
  const dashboard = useQuery(api.dashboard.get, provisioned ? {} : "skip");

  if (!provisioned || dashboard === undefined) {
    return (
      <div className="text-muted-foreground animate-pulse text-sm">Loading dashboard…</div>
    );
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
    <Suspense
      fallback={
        <div className="text-muted-foreground animate-pulse text-sm">Loading dashboard…</div>
      }
    >
      <DashboardInner />
    </Suspense>
  );
}
