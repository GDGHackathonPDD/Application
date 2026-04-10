"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useConvexAuth } from "convex/react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";

const ConvexProvisionContext = createContext<{ provisioned: boolean }>({ provisioned: false });

export function ConvexProvisionProvider({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const ensureExists = useMutation(api.users.ensureExists);
  const [provisioned, setProvisioned] = useState(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      void Promise.resolve().then(() => setProvisioned(false));
      return;
    }
    let cancelled = false;
    void ensureExists()
      .then(() => {
        if (!cancelled) setProvisioned(true);
      })
      .catch(() => {
        if (!cancelled) setProvisioned(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, ensureExists]);

  return (
    <ConvexProvisionContext.Provider value={{ provisioned: provisioned && isAuthenticated }}>
      {children}
    </ConvexProvisionContext.Provider>
  );
}

export function useConvexProvisioned() {
  return useContext(ConvexProvisionContext);
}
