"use client";

import { useAuth } from "@clerk/nextjs";
import { createContext, useContext, useEffect, useState } from "react";
import { useConvexAuth } from "convex/react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";

const ConvexProvisionContext = createContext<{ provisioned: boolean }>({ provisioned: false });

/** Convex can report authenticated a tick before the Clerk → Convex JWT is attached to requests. */
async function withNotAuthenticatedRetry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Not authenticated") && attempt < 2) {
        await new Promise((r) => setTimeout(r, 80 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw last;
}

export function ConvexProvisionProvider({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { getToken, isLoaded: clerkLoaded, isSignedIn } = useAuth();
  const ensureExists = useMutation(api.users.ensureExists);
  const syncBrowserTimezone = useMutation(api.users.syncBrowserTimezone);
  const [provisioned, setProvisioned] = useState(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !clerkLoaded || !isSignedIn) {
      void Promise.resolve().then(() => setProvisioned(false));
      return;
    }
    let cancelled = false;
    const browserTz =
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : undefined;
    void (async () => {
      const token = await getToken({ template: "convex" });
      if (!token || cancelled) {
        setProvisioned(false);
        return;
      }
      try {
        await withNotAuthenticatedRetry(() => ensureExists({}));
        if (!browserTz || cancelled) {
          if (!cancelled) setProvisioned(true);
          return;
        }
        await syncBrowserTimezone({ browser_timezone: browserTz }).catch(() => {
          /* Older deployments without syncBrowserTimezone — ignore */
        });
        if (!cancelled) setProvisioned(true);
      } catch {
        if (!cancelled) setProvisioned(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isLoading,
    isAuthenticated,
    clerkLoaded,
    isSignedIn,
    getToken,
    ensureExists,
    syncBrowserTimezone,
  ]);

  return (
    <ConvexProvisionContext.Provider value={{ provisioned: provisioned && isAuthenticated }}>
      {children}
    </ConvexProvisionContext.Provider>
  );
}

export function useConvexProvisioned() {
  return useContext(ConvexProvisionContext);
}
