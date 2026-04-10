"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/setup", label: "Setup" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/today", label: "Today" },
  { href: "/schedule", label: "Schedule" },
  { href: "/debug", label: "Debug" },
] as const

export function AppNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-1" aria-label="Main">
      {LINKS.map(({ href, label }) => {
        const active =
          pathname === href || (href !== "/setup" && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
