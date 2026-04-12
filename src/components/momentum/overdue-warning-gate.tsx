"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { TriangleAlert } from "lucide-react";

import { useConvexProvisioned } from "@/components/convex-provision-context";
import { useEffectiveDate } from "@/components/effective-date-context";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function OverdueWarningGate() {
  const { provisioned } = useConvexProvisioned();
  const { effectiveDateIso, isReady } = useEffectiveDate();
  const acknowledge = useMutation(api.overdueAcknowledgments.acknowledgeForDate);
  const gate = useQuery(
    api.overdueAcknowledgments.getStatus,
    provisioned && isReady ? { asOfDate: effectiveDateIso } : "skip"
  );
  const [submitting, setSubmitting] = useState(false);

  const summary = useMemo(() => {
    if (!gate) return null;
    const yesterdayLine =
      gate.yesterdayOverdueCount > 0
        ? `${gate.yesterdayOverdueCount} ${gate.yesterdayOverdueCount === 1 ? "task was" : "tasks were"} still overdue yesterday.`
        : "You still have overdue work carrying over from earlier days.";
    const totalLine = `Total overdue time so far: ${formatMinutes(gate.totalOverdueMinutes)}.`;
    return { yesterdayLine, totalLine };
  }, [gate]);

  if (!provisioned || !isReady || gate === undefined || !gate.shouldBlock || !summary) {
    return null;
  }

  return (
    <AlertDialog open onOpenChange={() => {}}>
      <AlertDialogContent className="border-amber-500/40 bg-background sm:max-w-xl">
        <AlertDialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <TriangleAlert className="size-5" aria-hidden />
            </div>
            <AlertDialogTitle className="text-balance text-2xl text-amber-700 dark:text-amber-300">
              You have {gate.totalOverdueCount} overdue{" "}
              {gate.totalOverdueCount === 1 ? "task" : "tasks"}.
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm leading-6 text-muted-foreground">
              <div>{summary.yesterdayLine}</div>
              <div>{summary.totalLine}</div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            type="button"
            variant="destructive"
            className="min-w-40"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                await acknowledge({ forDate: gate.asOfDate });
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? "Acknowledging..." : "Ok"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
