"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useAction,
  useQueries,
  type RequestForQueries,
} from "convex/react";
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

function patchMatchesServer(server: OverallTask, patch: Partial<OverallTask>): boolean {
  const keys = Object.keys(patch) as (keyof OverallTask)[];
  if (keys.length === 0) return true;
  return keys.every((k) => server[k] === patch[k]);
}

const WEEKLY_KEYS: (keyof WeeklyAvailability)[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

/** Compare hours with tolerance for float noise from the server. */
function weeklyAvailabilityEquals(a: WeeklyAvailability, b: WeeklyAvailability): boolean {
  return WEEKLY_KEYS.every((k) => Math.round(a[k] * 1000) === Math.round(b[k] * 1000));
}

type AgentPlanningState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; agent_api_configured: boolean }
  | { kind: "unavailable" };

export function SetupScreen() {
  const { provisioned } = useConvexProvisioned();
  const tasksList = useQuery(api.tasks.list, provisioned ? {} : "skip");
  const availabilityList = useQuery(api.availability.list, provisioned ? {} : "skip");
  const canvasRow = useQuery(api.canvasIcs.getSettings, provisioned ? {} : "skip");

  // `useQueries` passes this object to `useSubscription`; a new `{}` each render
  // changes subscription identity and triggers setState during render → infinite loop.
  const agentPlanningQueries = useMemo((): RequestForQueries =>
    provisioned
      ? {
          agentPlanningConfig: {
            query: api.plans.agentPlanningConfig,
            args: {},
          },
        }
      : {},
    [provisioned],
  );
  const planningQuery = useQueries(agentPlanningQueries);
  const planningResult = planningQuery.agentPlanningConfig;

  const agentPlanning: AgentPlanningState = useMemo(() => {
    if (!provisioned) return { kind: "idle" };
    if (planningResult === undefined) return { kind: "loading" };
    if (planningResult instanceof Error) {
      console.warn("[SetupScreen] agentPlanningConfig failed:", planningResult);
      return { kind: "unavailable" };
    }
    return {
      kind: "ok",
      agent_api_configured: planningResult.agent_api_configured,
    };
  }, [provisioned, planningResult]);

  const createTask = useMutation(api.tasks.create);
  const updateTask = useMutation(api.tasks.update);
  const removeTask = useMutation(api.tasks.remove);
  const upsertAvailability = useMutation(api.availability.upsert);
  const saveCanvasUrl = useMutation(api.canvasIcs.saveSettings);
  const saveUploadedIcsMutation = useMutation(api.canvasIcs.saveUploadedIcs);
  const clearUploadedIcsMutation = useMutation(api.canvasIcs.clearUploadedIcs);
  const syncCanvas = useAction(api.canvasIcs.sync);

  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(() => new Set());
  const [pendingEdits, setPendingEdits] = useState<Record<string, Partial<OverallTask>>>({});
  const [canvas, setCanvas] = useState(() => canvasSettingsToUi(null));
  /** When true, do not overwrite `canvas` from Convex while the user edits the feed URL. */
  const [canvasFeedDirty, setCanvasFeedDirty] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const [addTaskBusy, setAddTaskBusy] = useState(false);
  const [addTaskError, setAddTaskError] = useState<string | null>(null);
  const [removeTaskError, setRemoveTaskError] = useState<string | null>(null);

  const debouncers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const serverTasks = useMemo((): OverallTask[] => {
    if (!tasksList) return [];
    return tasksList.filter((t) => !t.parent_task_id).map(taskToOverallTask);
  }, [tasksList]);

  const tasks = useMemo(() => {
    return serverTasks
      .filter((t) => !pendingDeletes.has(t.id))
      .map((t) => {
        const patch = pendingEdits[t.id];
        return patch ? { ...t, ...patch } : t;
      });
  }, [serverTasks, pendingDeletes, pendingEdits]);

  const serverWeekly = useMemo(
    () => availabilityRowsToWeekly(availabilityList ?? []),
    [availabilityList]
  );

  /** Immediate UI while Convex catches up; cleared when subscription matches. */
  const [pendingWeekly, setPendingWeekly] = useState<WeeklyAvailability | null>(null);

  const availabilitySyncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestAvailabilityForSyncRef = useRef<WeeklyAvailability | null>(null);

  const availability = pendingWeekly ?? serverWeekly;

  useEffect(() => {
    if (pendingWeekly === null) return;
    if (weeklyAvailabilityEquals(pendingWeekly, serverWeekly)) {
      setPendingWeekly(null);
    }
  }, [pendingWeekly, serverWeekly]);

  useEffect(() => {
    const serverIds = new Set(serverTasks.map((t) => t.id));
    setPendingEdits((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (!serverIds.has(id)) {
          delete next[id];
          changed = true;
          continue;
        }
        const server = serverTasks.find((t) => t.id === id);
        if (!server) continue;
        const patch = next[id];
        if (patch && patchMatchesServer(server, patch)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [serverTasks]);

  useEffect(() => {
    if (!tasksList) return;
    const ids = new Set(
      tasksList.filter((t) => !t.parent_task_id).map((t) => t.id)
    );
    setPendingDeletes((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of prev) {
        if (!ids.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tasksList]);

  useEffect(() => {
    if (canvasRow === undefined) return;
    if (canvasFeedDirty) return;
    setCanvas(canvasSettingsToUi(canvasRow));
  }, [canvasRow, canvasFeedDirty]);

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
      setPendingEdits((prev) => ({
        ...prev,
        [id]: { ...(prev[id] ?? {}), ...patch },
      }));
      schedulePersist(id, patch);
    },
    [schedulePersist]
  );

  const handleRemove = useCallback(
    async (id: string) => {
      setRemoveTaskError(null);
      const pending = debouncers.current.get(id);
      if (pending) clearTimeout(pending);
      debouncers.current.delete(id);
      setPendingDeletes((prev) => new Set(prev).add(id));
      setPendingEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      try {
        await removeTask({ taskId: id as Id<"tasks"> });
      } catch (e) {
        setRemoveTaskError(readConvexErrorMessage(e));
        setPendingDeletes((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [removeTask]
  );

  const handleAddRow = useCallback(async () => {
    const due = new Date();
    due.setDate(due.getDate() + 7);
    setAddTaskError(null);
    setAddTaskBusy(true);
    try {
      /**
       * `tasks.create` schedules `plans.mergeNewTaskPlan` (incremental plan + LLM
       * decomposition for this task only). Do not also call `plans.generate`
       * here — that full replan races the merge and can insert a second plan.
       */
      await createTask({
        title: "New task",
        due_date: due.toISOString().slice(0, 10),
        estimated_hours: 2,
        priority: "medium",
        progress_percent: 0,
        color: COLORS[tasks.length % COLORS.length],
      });
    } catch (e) {
      setAddTaskError(readConvexErrorMessage(e));
    } finally {
      setAddTaskBusy(false);
    }
  }, [createTask, tasks.length]);

  const handleAvailability = useCallback(
    (next: WeeklyAvailability) => {
      setPendingWeekly(next);
      latestAvailabilityForSyncRef.current = next;
      if (availabilitySyncDebounceRef.current) {
        clearTimeout(availabilitySyncDebounceRef.current);
      }
      availabilitySyncDebounceRef.current = setTimeout(() => {
        availabilitySyncDebounceRef.current = null;
        const payload = latestAvailabilityForSyncRef.current;
        if (payload) {
          void upsertAvailability({ days: weeklyAvailabilityToDayEntries(payload) });
        }
      }, 400);
    },
    [upsertAvailability]
  );

  const handleSaveCanvas = useCallback(async () => {
    setCanvasError(null);
    setCanvas((c) => ({ ...c, status: "syncing" }));
    try {
      await saveCanvasUrl({ feed_url: canvas.feedUrl });
      setCanvasFeedDirty(false);
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
      setCanvasFeedDirty(false);
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
      setCanvasFeedDirty(false);
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
          {agentPlanning.kind === "ok" && !agentPlanning.agent_api_configured ? (
            <div
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
              role="status"
            >
              LLM step titles need the Agent API from Convex: set{" "}
              <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-xs">
                AGENT_API_URL
              </code>{" "}
              (and{" "}
              <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-xs">
                AGENT_API_KEY
              </code>{" "}
              if your Agent API requires it) in the{" "}
              <strong>Convex dashboard → Settings → Environment Variables</strong>, not
              only in <code className="font-mono text-xs">.env.local</code>. The Agent API
              process also needs{" "}
              <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-xs">
                OPENROUTER_API_KEY
              </code>
              .
            </div>
          ) : null}
          {agentPlanning.kind === "unavailable" ? (
            <div
              className="rounded-lg border border-muted-foreground/25 bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
              role="status"
            >
              Could not load planning configuration from Convex. If this is production,
              deploy the latest backend:{" "}
              <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-xs">
                cd Application && npx convex deploy
              </code>
              , then set{" "}
              <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-xs">
                AGENT_API_URL
              </code>{" "}
              (and{" "}
              <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-xs">
                AGENT_API_KEY
              </code>{" "}
              if needed) in the Convex dashboard → Environment Variables.
            </div>
          ) : null}
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
              disabled={addTaskBusy}
            >
              {addTaskBusy ? "Adding…" : "Add task"}
            </Button>
            {addTaskError ? (
              <p className="text-destructive text-sm" role="alert">
                {addTaskError}
              </p>
            ) : null}
            {removeTaskError ? (
              <p className="text-destructive text-sm" role="alert">
                {removeTaskError}
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
              setCanvasFeedDirty(true);
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
