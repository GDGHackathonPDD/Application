"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { ConvexError } from "convex/values";
import {
  ArrowClockwiseIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

import { api } from "@convex/_generated/api";
import { AppLoadingLogo } from "@/components/app-loading-logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { HelpIconDialog } from "@/components/ui/help-icon-dialog";
import { useConvexProvisioned } from "@/components/convex-provision-context";
import {
  formatCompactSyncTime,
  formatSyncStatusForDisplay,
} from "@/lib/momentum/sync-display";
import { cn } from "@/lib/utils";

import { AiGendaCalendarHelpTrigger } from "./aigenda-calendar-help-trigger";

function formatGoogleOAuthErrorReason(raw: string | null): string {
  if (!raw) return "";
  const reason = decodeURIComponent(raw);
  if (reason === "clerk_jwt_template_convex_missing") {
    return (
      'Clerk has no JWT template named "convex". In the Clerk Dashboard go to JWT Templates → ' +
      "New → pick the Convex template (it must be named convex). Then try Connect again. " +
      "https://docs.convex.dev/auth/clerk"
    );
  }
  return reason;
}

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

function GoogleCalendarSectionInner() {
  const { provisioned } = useConvexProvisioned();
  const searchParams = useSearchParams();
  const status = useQuery(api.googleCalendar.getStatus, provisioned ? {} : "skip");
  const disconnect = useMutation(api.googleCalendar.disconnect);
  const syncGoogle = useAction(api.googleCalendarSync.sync);

  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthBanner, setOauthBanner] = useState<"connected" | "error" | null>(null);

  useEffect(() => {
    const g = searchParams.get("google_calendar");
    if (g === "connected") {
      setOauthBanner("connected");
      return;
    }
    if (g === "error") {
      setOauthBanner("error");
    }
  }, [searchParams]);

  const handleSync = useCallback(async () => {
    setError(null);
    setSyncing(true);
    try {
      await syncGoogle({});
    } catch (e) {
      setError(readConvexErrorMessage(e));
    } finally {
      setSyncing(false);
    }
  }, [syncGoogle]);

  const handleDisconnect = useCallback(async () => {
    setError(null);
    try {
      await disconnect({});
    } catch (e) {
      setError(readConvexErrorMessage(e));
    }
  }, [disconnect]);

  if (!provisioned || status === undefined) {
    return (
      <div
        className="relative overflow-hidden rounded-xl border bg-muted/20 p-4"
        aria-busy="true"
        aria-label="Loading Google Calendar"
      >
        <div
          className="bg-primary/35 absolute top-0 bottom-0 left-0 w-1"
          aria-hidden
        />
        <AppLoadingLogo variant="section" label="Loading Google Calendar" />
      </div>
    );
  }

  const connected = status.connected;

  const syncSummaryParts: string[] = [];
  if (status.lastSyncAt) {
    syncSummaryParts.push(`Last sync ${formatCompactSyncTime(status.lastSyncAt)}`);
  }
  const statusLine = formatSyncStatusForDisplay(status.lastSyncStatus);
  if (statusLine) syncSummaryParts.push(statusLine);

  return (
    <div className="relative space-y-4 overflow-hidden rounded-xl border bg-muted/20 p-4">
      <div className="bg-primary/45 absolute top-0 bottom-0 left-0 w-1" aria-hidden />

      <div className="relative flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-sm font-medium">Google Calendar</p>
            <AiGendaCalendarHelpTrigger />
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            OAuth · AiGenda calendar only · tokens encrypted
          </p>
        </div>
        <HelpIconDialog
          title="Import without Google API"
          triggerLabel="ICS import options"
          description="Use a secret calendar URL instead of OAuth."
        >
          <p className="text-muted-foreground text-sm leading-relaxed">
            Use{" "}
            <strong className="text-foreground">Calendar import (ICS)</strong> above with a
            Google secret iCal URL, or read{" "}
            <Link
              href="https://support.google.com/calendar/answer/376483"
              className="text-primary font-medium underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google&apos;s guide
            </Link>
            .
          </p>
        </HelpIconDialog>
      </div>

      {oauthBanner === "connected" ? (
        <Alert
          className={cn(
            "border-emerald-500/35 bg-emerald-500/[0.09] py-3 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-50",
            "[&_[data-slot=alert-description]]:text-emerald-900/90 dark:[&_[data-slot=alert-description]]:text-emerald-100/90"
          )}
        >
          <CheckCircleIcon className="text-emerald-600 dark:text-emerald-300" weight="duotone" />
          <AlertTitle className="text-sm">Connected</AlertTitle>
          <AlertDescription className="text-xs">You can sync below.</AlertDescription>
        </Alert>
      ) : null}
      {oauthBanner === "error" ? (
        <Alert variant="destructive" className="py-3">
          <WarningCircleIcon weight="duotone" />
          <AlertTitle className="text-sm">Connection failed</AlertTitle>
          <AlertDescription className="text-xs">
            {searchParams.get("reason")
              ? formatGoogleOAuthErrorReason(searchParams.get("reason"))
              : "Google did not complete authorization. Try Connect again."}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {!connected ? (
            <Button type="button" size="sm" asChild>
              <a href="/api/google-calendar/auth?return_to=/setup">
                <CalendarBlankIcon className="mr-1.5 size-4" aria-hidden />
                Connect Google Calendar
              </a>
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSync()}
                disabled={syncing}
              >
                <ArrowClockwiseIcon
                  className={cn("mr-1.5 size-4", syncing && "animate-spin")}
                  aria-hidden
                />
                Sync from AiGenda
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleDisconnect()}
                disabled={syncing}
              >
                Disconnect
              </Button>
            </>
          )}
        </div>
        {connected ? (
          <div className="text-muted-foreground min-w-0 max-w-md space-y-1 text-xs">
            {status.connectedEmail ? (
              <p
                className="text-foreground/90 truncate font-medium"
                title={status.connectedEmail}
              >
                {status.connectedEmail}
              </p>
            ) : null}
            {syncSummaryParts.length > 0 ? (
              <p className="leading-snug tabular-nums">{syncSummaryParts.join(" · ")}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function GoogleCalendarSection() {
  return (
    <Suspense
      fallback={
        <div
          className="relative overflow-hidden rounded-xl border bg-muted/20 p-4"
          aria-busy="true"
          aria-label="Loading Google Calendar"
        >
          <div
            className="bg-primary/35 absolute top-0 bottom-0 left-0 w-1"
            aria-hidden
          />
          <AppLoadingLogo variant="section" label="Loading Google Calendar" />
        </div>
      }
    >
      <GoogleCalendarSectionInner />
    </Suspense>
  );
}
