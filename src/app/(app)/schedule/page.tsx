"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

import { ScheduleScreen } from "@/components/momentum/schedule-screen";
import { useConvexProvisioned } from "@/components/convex-provision-context";
import { mapDashboardToMomentum } from "@/lib/convex-to-momentum";

function ScheduleInner() {
  const { provisioned } = useConvexProvisioned();
  const dashboard = useQuery(api.dashboard.get, provisioned ? {} : "skip");

  if (!provisioned || dashboard === undefined) {
    return (
      <div className="text-muted-foreground animate-pulse text-sm">Loading schedule…</div>
    );
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
    <Suspense
      fallback={
        <div className="text-muted-foreground animate-pulse text-sm">Loading schedule…</div>
      }
    >
      <ScheduleInner />
    </Suspense>
  );
}
