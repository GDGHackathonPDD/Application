"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { ConvexError } from "convex/values";
import { CalendarBlankIcon, ArrowClockwiseIcon } from "@phosphor-icons/react";

import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useConvexProvisioned } from "@/components/convex-provision-context";
import { cn } from "@/lib/utils";

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
      <div className="text-muted-foreground animate-pulse text-sm">Loading Google Calendar…</div>
    );
  }

  const connected = status.connected;

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-medium">Google Calendar (API)</p>
        <p className="text-muted-foreground text-xs">
          Connect once with Google OAuth. Sync pulls events from your primary calendar into
          tasks (same as ICS sync). Uses read-only Calendar access; tokens are encrypted in
          Convex.
        </p>
      </div>

      {oauthBanner === "connected" ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
          Google Calendar connected. You can sync below.
        </p>
      ) : null}
      {oauthBanner === "error" ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Google connection failed
          {searchParams.get("reason")
            ? `: ${formatGoogleOAuthErrorReason(searchParams.get("reason"))}`
            : "."}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {!connected ? (
          <Button type="button" size="sm" asChild>
            <a href="/api/google-calendar/auth">
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
              Sync from Google
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
            <span className="text-muted-foreground text-xs">
              {status.connectedEmail ? (
                <>Signed in as {status.connectedEmail}</>
              ) : (
                <>Connected</>
              )}
              {status.lastSyncAt ? (
                <> · Last sync {new Date(status.lastSyncAt).toLocaleString()}</>
              ) : null}
              {status.lastSyncStatus ? <> · {status.lastSyncStatus}</> : null}
            </span>
          </>
        )}
      </div>

      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}

      <Separator />

      <p className="text-muted-foreground text-xs">
        Prefer not to grant API access? Use{" "}
        <strong className="text-foreground">Calendar import (ICS)</strong> above with your
        Google Calendar secret iCal URL, or see{" "}
        <Link
          href="https://support.google.com/calendar/answer/376483"
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google&apos;s instructions
        </Link>
        .
      </p>
    </div>
  );
}

export function GoogleCalendarSection() {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground text-sm">Loading Google Calendar…</div>
      }
    >
      <GoogleCalendarSectionInner />
    </Suspense>
  );
}
