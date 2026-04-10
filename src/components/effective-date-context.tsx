"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { localDateIso } from "@/lib/local-date";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "momentum_effective_date_override";

type EffectiveDateContextValue = {
  /** Calendar YYYY-MM-DD: real local today when no override, else the chosen day. */
  effectiveDateIso: string;
  /** When set, Convex `dashboard.get` uses `debugAsOf` and the UI anchors to this day. */
  overrideDateIso: string | null;
  setOverrideDate: (iso: string | null) => void;
  isOverrideActive: boolean;
};

const EffectiveDateContext = createContext<EffectiveDateContextValue | null>(null);

export function EffectiveDateProvider({ children }: { children: React.ReactNode }) {
  const [overrideDateIso, setOverrideState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        setOverrideState(raw);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setOverrideDate = useCallback((iso: string | null) => {
    setOverrideState(iso);
    try {
      if (iso === null) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, iso);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const effectiveDateIso = overrideDateIso ?? localDateIso();

  const value = useMemo<EffectiveDateContextValue>(
    () => ({
      effectiveDateIso,
      overrideDateIso,
      setOverrideDate,
      isOverrideActive: overrideDateIso !== null,
    }),
    [effectiveDateIso, overrideDateIso, setOverrideDate]
  );

  return (
    <EffectiveDateContext.Provider value={value}>{children}</EffectiveDateContext.Provider>
  );
}

export function useEffectiveDate(): EffectiveDateContextValue {
  const ctx = useContext(EffectiveDateContext);
  if (!ctx) {
    throw new Error("useEffectiveDate must be used within EffectiveDateProvider");
  }
  return ctx;
}

/** Args for `api.dashboard.get` — sends `debugAsOf` when the user chose a simulated day. */
export function useDashboardConvexArgs(provisioned: boolean) {
  const { overrideDateIso } = useEffectiveDate();
  return useMemo(() => {
    if (!provisioned) return "skip" as const;
    if (overrideDateIso !== null) return { debugAsOf: overrideDateIso };
    return {};
  }, [provisioned, overrideDateIso]);
}

export function EffectiveDateBar({ className }: { className?: string }) {
  const { effectiveDateIso, isOverrideActive, setOverrideDate } = useEffectiveDate();

  return (
    <div
      className={cn(
        "border-border bg-muted/40 flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5 text-xs",
        className
      )}
    >
      <span className="text-muted-foreground hidden sm:inline">App date</span>
      <input
        type="date"
        className="border-input bg-background h-8 max-w-[11rem] rounded-md border px-2 text-xs shadow-sm"
        value={effectiveDateIso}
        onChange={(e) => {
          const next = e.target.value;
          if (next === localDateIso()) {
            setOverrideDate(null);
          } else {
            setOverrideDate(next);
          }
        }}
        aria-label="App calendar date"
      />
      {isOverrideActive ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setOverrideDate(null)}
        >
          Use real today
        </Button>
      ) : null}
    </div>
  );
}
