"use client";

import { AigendaLogo } from "@/components/aigenda-logo";
import { cn } from "@/lib/utils";

export type AppLoadingLogoProps = {
  /** Screen reader label (e.g. "Loading dashboard…") */
  label: string;
  className?: string;
  /** Logo size in px */
  size?: number;
  /**
   * `page` — main route loading (centered, tall area)
   * `section` — inside cards / bordered regions
   * `inline` — compact row (toolbars, sync rows)
   */
  variant?: "page" | "section" | "inline";
};

const variantClass: Record<NonNullable<AppLoadingLogoProps["variant"]>, string> = {
  page: "flex min-h-[min(70vh,32rem)] w-full flex-col items-center justify-center",
  section:
    "flex w-full min-h-[12rem] flex-col items-center justify-center py-8 sm:min-h-[14rem]",
  inline: "flex w-full items-center justify-center py-3",
};

const defaultSize: Record<NonNullable<AppLoadingLogoProps["variant"]>, number> = {
  page: 96,
  section: 72,
  inline: 48,
};

/**
 * Consistent loading state: Aigenda mark with looping hover-style animation.
 */
export function AppLoadingLogo({
  label,
  className,
  size,
  variant = "page",
}: AppLoadingLogoProps) {
  const resolvedSize = size ?? defaultSize[variant];

  return (
    <div
      className={cn(variantClass[variant], className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <AigendaLogo
        size={resolvedSize}
        loadingPulse
        markOnly
        className="text-primary"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
