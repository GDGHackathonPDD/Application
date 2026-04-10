"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useConvexProvisioned } from "@/components/convex-provision-context";
import {
  availabilityRowsToWeekly,
  canvasSettingsToUi,
  taskToOverallTask,
  weeklyAvailabilityToDayEntries,
} from "@/lib/convex-to-momentum";
import type { OverallTask, WeeklyAvailability } from "@/lib/types/momentum";

import { AvailabilityGrid } from "./availability-grid";
import { CanvasIcsSection } from "./canvas-ics-section";
import { type TaskRowErrors, TaskTable } from "./task-table";

const COLORS = ["#6366f1", "#0ea5e9", "#22c55e", "#f59e0b", "#ec4899"];

function validateTasks(tasks: OverallTask[]) {
  const errors: Record<string, TaskRowErrors> = {};
  for (const t of tasks) {
    const row: TaskRowErrors = {};
    if (!t.title.trim()) row.title = "Title is required";
    if (!t.dueDate) row.dueDate = "Due date required";
    if (!t.estimatedHours || t.estimatedHours <= 0)
      row.estimatedHours = "Must be greater than 0";
    if (t.progressPercent < 0 || t.progressPercent > 100) row.progress = "0–100";
    if (Object.keys(row).length) errors[t.id] = row;
  }
  return errors;
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

function patchToConvex(patch: Partial<OverallTask>) {
  const p: {
    title?: string;
    due_date?: string;
    estimated_hours?: number;
    priority?: "low" | "medium" | "high";
    progress_percent?: number;
    color?: string | null;
  } = {};
  if (patch.title !== undefined) p.title = patch.title;
  if (patch.dueDate !== undefined) p.due_date = patch.dueDate;
  if (patch.estimatedHours !== undefined) p.estimated_hours = patch.estimatedHours;
  if (patch.priority !== undefined) p.priority = patch.priority;
  if (patch.progressPercent !== undefined) p.progress_percent = patch.progressPercent;
  if (patch.color !== undefined) p.color = patch.color;
  return p;
}

export function SetupScreen() {
  const { provisioned } = useConvexProvisioned();
  const tasksList = useQuery(api.tasks.list, provisioned ? {} : "skip");
  const availabilityList = useQuery(api.availability.list, provisioned ? {} : "skip");
  const canvasRow = useQuery(api.canvasIcs.getSettings, provisioned ? {} : "skip");

  const createTask = useMutation(api.tasks.create);
  const updateTask = useMutation(api.tasks.update);
  const removeTask = useMutation(api.tasks.remove);
  const upsertAvailability = useMutation(api.availability.upsert);
  const saveCanvasUrl = useMutation(api.canvasIcs.saveSettings);
  const saveUploadedIcsMutation = useMutation(api.canvasIcs.saveUploadedIcs);
  const clearUploadedIcsMutation = useMutation(api.canvasIcs.clearUploadedIcs);
  const syncCanvas = useAction(api.canvasIcs.sync);
  const generatePlan = useAction(api.plans.generate);

  const [tasks, setTasks] = useState<OverallTask[]>([]);
  const [availability, setAvailability] = useState<WeeklyAvailability>({
    sun: 0,
    mon: 0,
    tue: 0,
    wed: 0,
    thu: 0,
    fri: 0,
    sat: 0,
  });
  const [canvas, setCanvas] = useState(() =>
    canvasSettingsToUi(null)
  );
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const [planGenerating, setPlanGenerating] = useState(false);
  const [planActionError, setPlanActionError] = useState<string | null>(null);

  const debouncers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!tasksList) return;
    setTasks(
      tasksList.filter((t) => !t.parent_task_id).map(taskToOverallTask)
    );
  }, [tasksList]);

  useEffect(() => {
    if (!availabilityList || availabilityList.length === 0) return;
    setAvailability(availabilityRowsToWeekly(availabilityList));
  }, [availabilityList]);

  useEffect(() => {
    if (canvasRow === undefined) return;
    setCanvas(canvasSettingsToUi(canvasRow));
  }, [canvasRow]);

  const schedulePersist = useCallback(
    (taskId: string, patch: Partial<OverallTask>) => {
      const prev = debouncers.current.get(taskId);
      if (prev) clearTimeout(prev);
      debouncers.current.set(
        taskId,
        setTimeout(() => {
          void updateTask({
            taskId: taskId as Id<"tasks">,
            patch: patchToConvex(patch),
          });
        }, 450)
      );
    },
    [updateTask]
  );

  const handleTaskChange = useCallback(
    (id: string, patch: Partial<OverallTask>) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
      );
      schedulePersist(id, patch);
    },
    [schedulePersist]
  );

  const handleRemove = useCallback(
    async (id: string) => {
      const pending = debouncers.current.get(id);
      if (pending) clearTimeout(pending);
      debouncers.current.delete(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      await removeTask({ taskId: id as Id<"tasks"> });
    },
    [removeTask]
  );

  const handleAddRow = useCallback(async () => {
    const due = new Date();
    due.setDate(due.getDate() + 7);
    setPlanActionError(null);
    setPlanGenerating(true);
    try {
      await createTask({
        title: "New task",
        due_date: due.toISOString().slice(0, 10),
        estimated_hours: 2,
        priority: "medium",
        progress_percent: 0,
        color: COLORS[tasks.length % COLORS.length],
      });
      await generatePlan({ recovery_mode: true });
    } catch (e) {
      setPlanActionError(readConvexErrorMessage(e));
    } finally {
      setPlanGenerating(false);
    }
  }, [createTask, generatePlan, tasks.length]);

  const handleAvailability = useCallback(
    (next: WeeklyAvailability) => {
      setAvailability(next);
      void upsertAvailability({ days: weeklyAvailabilityToDayEntries(next) });
    },
    [upsertAvailability]
  );

  const handleSaveCanvas = useCallback(async () => {
    setCanvasError(null);
    setCanvas((c) => ({ ...c, status: "syncing" }));
    try {
      await saveCanvasUrl({ feed_url: canvas.feedUrl });
      setCanvas((c) => ({ ...c, status: "ok" }));
    } catch (e) {
      setCanvasError(readConvexErrorMessage(e));
      setCanvas((c) => ({ ...c, status: "error" }));
    }
  }, [canvas.feedUrl, saveCanvasUrl]);

  const handleSyncCanvas = useCallback(async () => {
    setCanvasError(null);
    setSyncing(true);
    setCanvas((c) => ({ ...c, status: "syncing" }));
    try {
      await syncCanvas({});
      setCanvas((c) => ({
        ...c,
        status: "ok",
        lastSyncedAt: new Date().toISOString(),
      }));
    } catch (e) {
      setCanvasError(readConvexErrorMessage(e));
      setCanvas((c) => ({ ...c, status: "error" }));
    } finally {
      setSyncing(false);
    }
  }, [syncCanvas]);

  const handleUploadIcs = useCallback(
    async (icsText: string, fileName: string) => {
      setCanvasError(null);
      setCanvas((c) => ({ ...c, status: "syncing" }));
      try {
        await saveUploadedIcsMutation({ ics_text: icsText, file_name: fileName });
        setCanvas((c) => ({
          ...c,
          status: "ok",
          hasUploadedIcs: true,
          uploadedFileName: fileName,
        }));
      } catch (e) {
        setCanvasError(readConvexErrorMessage(e));
        setCanvas((c) => ({ ...c, status: "error" }));
      }
    },
    [saveUploadedIcsMutation]
  );

  const handleClearUpload = useCallback(async () => {
    setCanvasError(null);
    try {
      await clearUploadedIcsMutation({});
      setCanvas((c) => ({
        ...c,
        hasUploadedIcs: false,
        uploadedFileName: null,
        status: "idle",
      }));
    } catch (e) {
      setCanvasError(readConvexErrorMessage(e));
    }
  }, [clearUploadedIcsMutation]);

  const canvasLoaded = canvasRow !== undefined;
  const feedSavedInDb =
    Boolean((canvasRow?.feed_url ?? "").trim()) || Boolean(canvasRow?.has_uploaded_ics);
  const syncDisabled = !canvasLoaded || !feedSavedInDb;
  const syncDisabledReason = !canvasLoaded
    ? "Loading…"
    : !feedSavedInDb
      ? "Save a Canvas feed URL or upload an .ics file first, then sync."
      : undefined;

  const errors = useMemo(() => validateTasks(tasks), [tasks]);
  const weeklyAvail = useMemo(
    () => Object.values(availability).reduce((a, b) => a + b, 0),
    [availability]
  );
  const remainingRough = useMemo(() => {
    return tasks.reduce(
      (sum, t) => sum + t.estimatedHours * (1 - t.progressPercent / 100),
      0
    );
  }, [tasks]);

  if (!provisioned || tasksList === undefined || availabilityList === undefined) {
    return (
      <div className="text-muted-foreground animate-pulse text-sm">Loading setup…</div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Task setup</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Add overall tasks and weekly availability. Changes save to Convex.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tasks & availability</CardTitle>
          <CardDescription>
            Overall tasks use deadlines and estimated hours; the scheduler
            creates mini tasks on the calendar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <TaskTable
            tasks={tasks}
            errors={submitAttempted ? errors : undefined}
            onChange={handleTaskChange}
            onRemove={handleRemove}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRow}
              disabled={planGenerating}
            >
              {planGenerating ? "Decomposing schedule…" : "Add task"}
            </Button>
            {planActionError ? (
              <p className="text-destructive text-sm" role="alert">
                {planActionError}
              </p>
            ) : null}
          </div>

          <Separator />

          <AvailabilityGrid value={availability} onChange={handleAvailability} />

          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Quick check · </span>
            ~{remainingRough.toFixed(1)} h remaining work vs{" "}
            {weeklyAvail.toFixed(1)} h / week available (client estimate; server
            is source of truth).
          </div>

          <Separator />

          <CanvasIcsSection
            state={{ ...canvas, status: syncing ? "syncing" : canvas.status }}
            onFeedUrlChange={(feedUrl) => {
              setCanvasError(null);
              setCanvas((c) => ({ ...c, feedUrl }));
            }}
            onSave={handleSaveCanvas}
            onSync={handleSyncCanvas}
            onUploadIcs={handleUploadIcs}
            onClearUpload={handleClearUpload}
            errorMessage={canvasError}
            syncDisabled={syncDisabled}
            syncDisabledReason={syncDisabledReason}
          />
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              setSubmitAttempted(true);
              if (Object.keys(validateTasks(tasks)).length === 0) {
                void upsertAvailability({
                  days: weeklyAvailabilityToDayEntries(availability),
                });
              }
            }}
          >
            Save
          </Button>
          <Button type="button" variant="secondary" asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
