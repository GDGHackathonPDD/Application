"use client";

import { useRef } from "react";
import { ArrowClockwiseIcon, UploadSimpleIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { HelpIconDialog } from "@/components/ui/help-icon-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  formatCompactSyncTime,
  truncateMiddleFilename,
} from "@/lib/momentum/sync-display";
import type { CanvasSyncState } from "@/lib/types/momentum";
import { cn } from "@/lib/utils";

export function CanvasIcsSection({
  state,
  onFeedUrlChange,
  onSave,
  onSync,
  onUploadIcs,
  onClearUpload,
  errorMessage,
  syncDisabled,
  syncDisabledReason,
}: {
  state: CanvasSyncState;
  onFeedUrlChange: (url: string) => void;
  onSave: () => void;
  onSync: () => void;
  onUploadIcs: (icsText: string, fileName: string) => void | Promise<void>;
  onClearUpload: () => void | Promise<void>;
  errorMessage?: string | null;
  syncDisabled?: boolean;
  syncDisabledReason?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const displayName = state.uploadedFileName
    ? truncateMiddleFilename(state.uploadedFileName, 36)
    : null;

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Calendar import (ICS)</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Pull events from a feed URL or an uploaded{" "}
            <code className="text-[0.7rem]">.ics</code> file.
          </p>
        </div>
        <HelpIconDialog
          title="Calendar import (ICS)"
          triggerLabel="Full instructions for ICS import"
          description="How Canvas feeds, Google secret URLs, and file uploads work."
        >
          <div className="text-muted-foreground space-y-3 text-sm leading-relaxed">
            <p>
              Sync reads calendar events and turns them into tasks. Use a{" "}
              <strong className="text-foreground">Canvas</strong> calendar feed, a{" "}
              <strong className="text-foreground">secret iCal URL</strong> from Google, or
              any standard <code className="text-foreground text-xs">.ics</code> export.
            </p>
            <p>
              <strong className="text-foreground">Feed URL:</strong> In Canvas, open
              Calendar → Calendar feed and copy the private HTTPS URL (often{" "}
              <code className="text-xs">*.instructure.com</code>). In Google Calendar,
              use Settings → Integrate calendar → Secret address in iCal format.
            </p>
            <p>
              Saving a new URL clears a previously uploaded file.{" "}
              <strong className="text-foreground">Upload</strong> is limited to 512 KB and
              wins over the feed when both exist.
            </p>
          </div>
        </HelpIconDialog>
      </div>

      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Feed URL
        </Label>
        <div className="space-y-1.5">
          <Label htmlFor="canvas-feed" className="sr-only">
            Calendar feed URL
          </Label>
          <Input
            id="canvas-feed"
            type="url"
            placeholder="https://…"
            value={state.feedUrl}
            onChange={(e) => onFeedUrlChange(e.target.value)}
          />
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={onSave}>
          Save URL
        </Button>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Or upload .ics
        </Label>
        <p className="text-muted-foreground text-xs">
          Max 512 KB. Overrides the feed until removed.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".ics,text/calendar,application/ics"
          className="sr-only"
          aria-label="Upload ICS calendar file"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const text = await file.text();
            await onUploadIcs(text, file.name);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={state.status === "syncing"}
          >
            <UploadSimpleIcon className="mr-1.5 size-4" aria-hidden />
            Choose file
          </Button>
          {state.hasUploadedIcs ? (
            <>
              <span
                className="text-muted-foreground max-w-[min(100%,18rem)] truncate text-xs"
                title={state.uploadedFileName ?? undefined}
              >
                {displayName}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-8 px-2 text-xs"
                onClick={() => void onClearUpload()}
              >
                Remove
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground text-xs">No file</span>
          )}
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onSync}
          disabled={state.status === "syncing" || syncDisabled}
          title={syncDisabled ? syncDisabledReason : undefined}
        >
          <ArrowClockwiseIcon
            className={cn("size-4", state.status === "syncing" && "animate-spin")}
          />
          Sync now
        </Button>
        <span className="text-muted-foreground text-xs tabular-nums">
          {state.lastSyncedAt
            ? `Last sync ${formatCompactSyncTime(state.lastSyncedAt)}`
            : "Not synced yet"}
          {state.status === "error" ? " · Failed" : null}
        </span>
      </div>
      {errorMessage ? (
        <p className="text-destructive text-xs" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {syncDisabled && syncDisabledReason ? (
        <p className="text-muted-foreground text-xs">{syncDisabledReason}</p>
      ) : null}
    </div>
  );
}
