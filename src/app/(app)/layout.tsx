"use client";

import Link from "next/link";

import { AigendaLogo } from "@/components/aigenda-logo";
import { UserAccountMenu } from "@/components/auth/user-account-menu";
import {
  EffectiveDateBar,
  EffectiveDateProvider,
} from "@/components/effective-date-context";
import { AppNav } from "@/components/momentum/app-nav";
import { OverdueWarningGate } from "@/components/momentum/overdue-warning-gate";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <EffectiveDateProvider>
      <div className="flex min-h-svh flex-col">
        <OverdueWarningGate />
        <header className="border-border bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/setup"
              className="group flex items-center gap-2.5 font-semibold tracking-tight text-foreground"
            >
              <AigendaLogo markOnly parentGroup size={36} />
              <span className="text-lg tracking-tight transition-all duration-300 group-hover:tracking-normal">
                <span className="text-primary">AI</span>
                <span className="text-foreground/65 transition-colors duration-300 group-hover:text-foreground">
                  genda
                </span>
              </span>
            </Link>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <EffectiveDateBar />
              <AppNav />
              <ThemeToggle />
              <UserAccountMenu />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full flex-1 px-4 py-8">{children}</main>
      </div>
    </EffectiveDateProvider>
  );
}
