"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useAction, useQuery } from "convex/react"
import { useSearchParams } from "next/navigation"
import { ConvexError } from "convex/values"
import {
  ArrowClockwiseIcon,
  ArrowsClockwiseIcon,
  CalendarBlankIcon,
} from "@phosphor-icons/react"

import { api } from "@convex/_generated/api"
import { AppLoadingLogo } from "@/components/app-loading-logo"
import { Button } from "@/components/ui/button"
import { useConvexProvisioned } from "@/components/convex-provision-context"
import { buildPlanGooglePushPayload } from "@/lib/momentum/plan-to-google-events"
import type { OverallTask, UserPlan } from "@/lib/types/momentum"
import { cn } from "@/lib/utils"

import { EXPORT_PANEL_ACTION_CLASS } from "./ics-export-panel"
import { AiGendaCalendarHelpTrigger } from "./aigenda-calendar-help-trigger"

function readConvexErrorMessage(e: unknown): string {
  if (e instanceof ConvexError) {
    const d = e.data as { message?: string }
    if (typeof d?.message === "string") return d.message
  }
  if (e instanceof Error) {
    const m = e.message
    try {
      const j = JSON.parse(m) as { message?: string }
      if (typeof j?.message === "string") return j.message
    } catch {
      /* not JSON */
    }
    return m
  }
  return String(e)
}

/** Turn stored status + time into a short line (avoids "ok: … in AiGenda Calendar · long locale string"). */
function formatPushResultLine(
  lastPushStatus: string,
  lastPushAt: number | undefined
): string {
  const okMatch = /^ok:\s*(\d+)\s+events\b/i.exec(lastPushStatus)
  if (okMatch) {
    const n = Number(okMatch[1])
    const countLabel = n === 1 ? "1 event" : `${n} events`
    if (lastPushAt === undefined) return countLabel
    const when = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(lastPushAt))
    return `${countLabel} · ${when}`
  }
  if (lastPushStatus.startsWith("push_error:")) {
    const msg = lastPushStatus.slice("push_error:".length).trim()
    return msg.length > 96 ? `${msg.slice(0, 93)}…` : msg
  }
  return lastPushStatus
}

function GoogleScheduleSyncInner({
  plan,
  tasksById,
  oauthReturnPath,
}: {
  plan: UserPlan
  tasksById: Map<string, OverallTask>
  oauthReturnPath: "/schedule" | "/dashboard"
}) {
  const { provisioned } = useConvexProvisioned()
  const searchParams = useSearchParams()
  const status = useQuery(api.googleCalendar.getStatus, provisioned ? {} : "skip")
  const pushSchedule = useAction(api.googleCalendarPush.pushSchedule)

  const [pushing, setPushing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [oauthBanner, setOauthBanner] = useState<"connected" | null>(null)

  useEffect(() => {
    if (searchParams.get("google_calendar") === "connected") {
      setOauthBanner("connected")
    }
  }, [searchParams])

  const handlePush = useCallback(async () => {
    setError(null)
    setPushing(true)
    try {
      const { timeZone, events } = buildPlanGooglePushPayload(plan, tasksById)
      await pushSchedule({ timeZone, events })
    } catch (e) {
      setError(readConvexErrorMessage(e))
    } finally {
      setPushing(false)
    }
  }, [plan, tasksById, pushSchedule])

  if (!provisioned || status === undefined) {
    return (
      <div aria-busy="true" aria-label="Loading Google Calendar">
        <AppLoadingLogo variant="inline" label="Loading Google Calendar" />
      </div>
    )
  }

  const connected = status.connected

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-1 gap-3">
        <div className="bg-background/80 text-primary ring-border flex size-11 shrink-0 items-center justify-center rounded-lg ring-1">
          <ArrowsClockwiseIcon className="size-6" weight="duotone" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h2 className="text-foreground text-base font-semibold tracking-tight">
              Sync to Google (AiGenda Calendar)
            </h2>
            <AiGendaCalendarHelpTrigger />
          </div>
          <p className="text-muted-foreground text-sm leading-snug">
            Writes only to your &quot;AiGenda Calendar&quot; (created if needed) and
            replaces its events with this window — same blocks as the .ics export.
          </p>
          {oauthBanner === "connected" ? (
            <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
              Google Calendar connected. You can sync to AiGenda Calendar below.
            </p>
          ) : null}
          {connected && status.lastPushStatus ? (
            <p className="text-foreground/90 text-xs font-medium tabular-nums">
              {formatPushResultLine(status.lastPushStatus, status.lastPushAt)}
            </p>
          ) : null}
          {error ? (
            <p className="text-destructive text-xs" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
      <div className="shrink-0">
        {!connected ? (
          <Button
            type="button"
            size="lg"
            variant="secondary"
            className={EXPORT_PANEL_ACTION_CLASS}
            asChild
          >
            <a
              href={`/api/google-calendar/auth?return_to=${encodeURIComponent(oauthReturnPath)}`}
            >
              <CalendarBlankIcon className="size-5" aria-hidden />
              Connect Google Calendar
            </a>
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            variant="secondary"
            className={EXPORT_PANEL_ACTION_CLASS}
            onClick={() => void handlePush()}
            disabled={pushing}
          >
            <ArrowClockwiseIcon
              className={cn("size-5", pushing && "animate-spin")}
              aria-hidden
            />
            Sync to AiGenda Calendar
          </Button>
        )}
      </div>
    </div>
  )
}

export function GoogleScheduleSync({
  plan,
  tasksById,
  oauthReturnPath = "/schedule",
}: {
  plan: UserPlan
  tasksById: Map<string, OverallTask>
  /** Where to land after Google OAuth (must match allowlist in oauth-state). */
  oauthReturnPath?: "/schedule" | "/dashboard"
}) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" aria-label="Loading Google Calendar">
          <AppLoadingLogo variant="inline" label="Loading Google Calendar" />
        </div>
      }
    >
      <GoogleScheduleSyncInner
        plan={plan}
        tasksById={tasksById}
        oauthReturnPath={oauthReturnPath}
      />
    </Suspense>
  )
}
