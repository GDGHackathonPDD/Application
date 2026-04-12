"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { Button } from "@/components/ui/button";
import { IsoDatePicker } from "@/components/ui/iso-date-picker";
import { localDateIso } from "@/lib/local-date";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "momentum_effective_date_override";

type EffectiveDateContextValue = {
  /** Calendar YYYY-MM-DD: real local today when no override, else the chosen day. */
  effectiveDateIso: string;
  realTodayIso: string;
  /** When set, Convex `dashboard.get` uses `debugAsOf` and the UI anchors to this day. */
  overrideDateIso: string | null;
  setOverrideDate: (iso: string | null) => void;
  isOverrideActive: boolean;
  isReady: boolean;
};

const EffectiveDateContext = createContext<EffectiveDateContextValue | null>(null);

export function EffectiveDateProvider({ children }: { children: React.ReactNode }) {
  const isReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [overrideDateIso, setOverrideState] = useState<string | null | undefined>(undefined);

  const storedOverrideDateIso = useMemo(() => {
    if (!isReady) {
      return null;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw;
      }
    } catch {
      /* ignore */
    }
    return null;
  }, [isReady]);

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

  const realTodayIso = isReady ? localDateIso() : "";
  const resolvedOverrideDateIso =
    overrideDateIso === undefined ? storedOverrideDateIso : overrideDateIso;
  const effectiveDateIso = resolvedOverrideDateIso ?? realTodayIso;

  const value = useMemo<EffectiveDateContextValue>(
    () => ({
      effectiveDateIso,
      realTodayIso,
      overrideDateIso: resolvedOverrideDateIso,
      setOverrideDate,
      isOverrideActive: resolvedOverrideDateIso !== null,
      isReady,
    }),
    [effectiveDateIso, isReady, realTodayIso, resolvedOverrideDateIso, setOverrideDate]
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
  const { isReady, overrideDateIso } = useEffectiveDate();
  return useMemo(() => {
    if (!provisioned || !isReady) return "skip" as const;
    if (overrideDateIso !== null) return { debugAsOf: overrideDateIso };
    return {};
  }, [isReady, provisioned, overrideDateIso]);
}

export function EffectiveDateBar({ className }: { className?: string }) {
  const { effectiveDateIso, isOverrideActive, isReady, realTodayIso, setOverrideDate } =
    useEffectiveDate();

  return (
    <div
      className={cn(
        "border-border bg-muted/40 flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5 text-xs",
        className
      )}
    >
      <span className="text-muted-foreground hidden sm:inline">App date</span>
      {isReady ? (
        <IsoDatePicker
          value={effectiveDateIso}
          onChange={(next) => {
            if (next === realTodayIso) {
              setOverrideDate(null);
            } else {
              setOverrideDate(next);
            }
          }}
          buttonClassName="h-8 min-w-[11rem] max-w-[11rem] justify-between text-xs"
          align="end"
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled
          className="h-8 min-w-[11rem] max-w-[11rem] justify-between text-xs font-normal tabular-nums"
        >
          Loading date...
        </Button>
      )}
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
