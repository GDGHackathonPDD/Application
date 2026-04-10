"use client";

import { useRef } from "react";
import { ArrowClockwiseIcon, UploadSimpleIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  /** Shown after a failed save/sync (Convex error message). */
  errorMessage?: string | null;
  /** When true, Sync is disabled (e.g. no URL saved yet). */
  syncDisabled?: boolean;
  syncDisabledReason?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-medium">Calendar import (ICS)</p>
        <p className="text-muted-foreground text-xs">
          Connect a Canvas feed, or upload any standard <code className="text-xs">.ics</code>{" "}
          file (Google Calendar, Apple Calendar, Outlook export, etc.). Sync imports
          events as tasks.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Option A — Canvas / web feed
        </Label>
        <p className="text-muted-foreground text-xs">
          Private HTTPS URL from Canvas → Calendar → Calendar feed (typically{" "}
          <code className="text-xs">*.instructure.com</code>). Saving a URL clears a
          previously uploaded file.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="canvas-feed">Feed URL</Label>
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
          Option B — Upload .ics file
        </Label>
        <p className="text-muted-foreground text-xs">
          Export from any calendar app. Max 512 KB. Upload takes priority over the
          feed URL when both exist.
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
            Choose .ics file
          </Button>
          {state.hasUploadedIcs ? (
            <>
              <span className="text-muted-foreground text-xs">
                Using:{" "}
                <span className="text-foreground font-medium">
                  {state.uploadedFileName ?? "uploaded calendar"}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-8 px-2 text-xs"
                onClick={() => void onClearUpload()}
              >
                Remove file
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground text-xs">No file uploaded</span>
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
            className={cn(
              "size-4",
              state.status === "syncing" && "animate-spin"
            )}
          />
          Sync now
        </Button>
        <span className="text-muted-foreground text-xs">
          {state.lastSyncedAt
            ? `Last synced ${new Date(state.lastSyncedAt).toLocaleString()}`
            : "Not synced yet"}
          {state.status === "error" && " · failed"}
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
