"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { EffectiveDateBar, EffectiveDateProvider } from "@/components/effective-date-context";
import { AppNav } from "@/components/momentum/app-nav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <EffectiveDateProvider>
      <div className="flex min-h-svh flex-col">
        <header className="border-border bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/setup"
              className="text-foreground font-semibold tracking-tight"
            >
              Momentum Coach
            </Link>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <EffectiveDateBar />
              <AppNav />
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full flex-1 px-4 py-8">{children}</main>
      </div>
    </EffectiveDateProvider>
  );
}
