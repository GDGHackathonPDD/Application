"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

import {
  useDashboardConvexArgs,
  useEffectiveDate,
} from "@/components/effective-date-context";
import { useConvexProvisioned } from "@/components/convex-provision-context";
import { FeasibilityBanner } from "@/components/momentum/feasibility-banner";
import { StatusBadge } from "@/components/momentum/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { mapDashboardToMomentum } from "@/lib/convex-to-momentum";
import type { DriftChannel } from "@convex/lib/types";

const DRIFT_CHANNELS: DriftChannel[] = [
  "OVERLOAD_OR_FEASIBILITY",
  "SLIPPAGE_BLOCKS",
  "STALLED_PROGRESS",
  "OVERDUE_GROWING",
  "SCHEDULE_STALE",
  "WORK_DEBT_RISING",
  "MUST_DO_STREAK_MISS",
];

export default function DebugPage() {
  const { provisioned } = useConvexProvisioned();
  const { effectiveDateIso, isOverrideActive, setOverrideDate } = useEffectiveDate();
  const dashboardArgs = useDashboardConvexArgs(provisioned);
  const dashboard = useQuery(api.dashboard.get, dashboardArgs);

  const mapped = useMemo(() => {
    if (!dashboard?.success) return null;
    return mapDashboardToMomentum(dashboard, { calendarAnchorYmd: effectiveDateIso });
  }, [dashboard, effectiveDateIso]);

  if (!provisioned || dashboard === undefined) {
    return (
      <div className="text-muted-foreground animate-pulse text-sm">Loading debug…</div>
    );
  }

  const drift = dashboard.data.drift;
  const overload = dashboard.data.overload;
  const period = dashboard.data.period;
  const dailySummary = dashboard.data.daily_summary;
  const incompleteBlocks = dashboard.data.miniTasks.filter((m) => !m.completed).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Signal debug</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          The <span className="text-foreground font-medium">App date</span> control in the header
          applies to every screen (Today, Dashboard, Schedule). Pick a day other than real today to
          send <code className="text-xs">debugAsOf</code> to the server and align feasibility, drift,
          and planning with that day. Complete tasks on{" "}
          <Link href="/today" className="text-primary underline-offset-4 hover:underline">
            Today
          </Link>
          , then change the app date to see how signals respond.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>App date</CardTitle>
          <CardDescription>
            {isOverrideActive
              ? `Override active — server uses debugAsOf=${effectiveDateIso} for dashboard data.`
              : "Using real today — dashboard matches live server time (no debugAsOf)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {isOverrideActive ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setOverrideDate(null)}>
              Use real today
            </Button>
          ) : null}
          <Button type="button" variant="secondary" size="sm" asChild>
            <Link href="/today">Open Today</Link>
          </Button>
        </CardContent>
      </Card>

      {mapped ? (
        <FeasibilityBanner feasibility={mapped.feasibility} />
      ) : (
        <p className="text-muted-foreground text-sm">No feasibility data.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Status
            {mapped ? <StatusBadge status={mapped.feasibility.status} /> : null}
            <Badge variant="outline" className="font-normal capitalize">
              overload: {overload.label}
            </Badge>
          </CardTitle>
          <CardDescription>
            Planning window {period.period_start} → {period.period_end} ({period.horizon_days}{" "}
            days)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
            <span>
              Incomplete mini blocks:{" "}
              <span className="text-foreground font-medium">{incompleteBlocks}</span>
            </span>
            <span>
              Drift score (norm):{" "}
              <span className="text-foreground font-medium">{drift.drift_score_norm}</span>
            </span>
            <span>
              Falling behind:{" "}
              <span className="text-foreground font-medium">{drift.falling_behind ? "yes" : "no"}</span>{" "}
              (work-only: {drift.falling_behind_work ? "yes" : "no"})
            </span>
            <span>
              At risk: <span className="text-foreground font-medium">{drift.at_risk ? "yes" : "no"}</span>
            </span>
          </div>
          {drift.reason_codes.length > 0 ? (
            <p className="text-muted-foreground">
              Top reasons:{" "}
              <span className="text-foreground font-mono text-xs">{drift.reason_codes.join(", ")}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Drift channels</CardTitle>
          <CardDescription>Weighted channel scores (0–1) for the current app date.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 font-mono text-xs">
            {DRIFT_CHANNELS.map((ch) => {
              const v = drift.channel_scores[ch];
              return (
                <li key={ch} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{ch}</span>
                  <span>{v !== undefined ? v : "—"}</span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily summary row</CardTitle>
          <CardDescription>
            When an override is active, <code className="text-xs">forDate</code> matches{" "}
            <code className="text-xs">{effectiveDateIso}</code>. With no override, the stored summary
            follows the server&apos;s UTC day for &quot;today&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {dailySummary ? (
            <p className="whitespace-pre-wrap">{dailySummary.summary_text}</p>
          ) : (
            <p className="text-muted-foreground">No daily summary stored for this date.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
