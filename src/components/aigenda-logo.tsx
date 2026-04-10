"use client"

import { cn } from "@/lib/utils"

const GRID_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const

function gridRectProps(i: number) {
  const col = i % 3
  const row = Math.floor(i / 3)
  return { x: 2 + col * 27, y: 2 + row * 27 }
}

export type AigendaLogoProps = {
  className?: string
  /** Icon viewBox size in px; layout scales with this. */
  size?: number
  showWordmark?: boolean
  showTagline?: boolean
  /** Only the interactive mark (no column layout); use beside inline titles. */
  markOnly?: boolean
  /**
   * When true, omit inner `group` so a parent with `group` (e.g. a Link) drives
   * `group-hover` on the mark.
   */
  parentGroup?: boolean
}

/**
 * Aigenda mark from `Aigendalogodesign/aigenda-logo.svg` with hover motion
 * from `Aigendalogodesign/src/app/App.tsx` (staggered grid, transitions, wordmark).
 */
function AigendaLogoMark({
  size,
  parentGroup,
}: {
  size: number
  parentGroup?: boolean
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 cursor-pointer text-primary",
        !parentGroup && "group"
      )}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Aigenda"
    >
        <svg
          className="absolute inset-0 size-full"
          viewBox="0 0 80 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          {GRID_INDICES.map((i) => {
            const { x, y } = gridRectProps(i)
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={22}
                height={22}
                rx={2}
                className="fill-primary/15 transition-all duration-500 group-hover:fill-primary/25"
                style={{ transitionDelay: `${i * 50}ms` }}
              />
            )
          })}

          <g className="opacity-40 transition-opacity duration-500 group-hover:opacity-60">
            <line
              x1="20"
              y1="20"
              x2="40"
              y2="40"
              stroke="currentColor"
              strokeWidth={1.5}
            />
            <line
              x1="60"
              y1="20"
              x2="40"
              y2="40"
              stroke="currentColor"
              strokeWidth={1.5}
            />
            <line
              x1="20"
              y1="60"
              x2="40"
              y2="40"
              stroke="currentColor"
              strokeWidth={1.5}
            />
            <line
              x1="60"
              y1="60"
              x2="40"
              y2="40"
              stroke="currentColor"
              strokeWidth={1.5}
            />
          </g>

          <g className="origin-center transition-transform duration-500 group-hover:scale-110">
            <circle cx="20" cy="20" r={4} fill="currentColor" />
            <circle cx="60" cy="20" r={4} fill="currentColor" />
            <circle cx="40" cy="40" r={5} fill="currentColor" />
            <circle cx="20" cy="60" r={4} fill="currentColor" />
            <circle cx="60" cy="60" r={4} fill="currentColor" />
          </g>

          <g className="origin-[40px_40px] transition-transform duration-500 group-hover:scale-[1.02]">
            <path
              d="M 20 65 Q 30 20 40 10"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
            />
            <polygon points="40,10 36,17 43,15" fill="currentColor" />
            <path
              d="M 40 10 Q 50 20 60 65"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
            />
            <polygon points="60,65 56,58 63,60" fill="currentColor" />
            <path
              d="M 26 48 Q 40 45 54 48"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
            />
          </g>
        </svg>
    </div>
  )
}

export function AigendaLogo({
  className,
  size = 80,
  showWordmark = false,
  showTagline = false,
  markOnly = false,
  parentGroup = false,
}: AigendaLogoProps) {
  const mark = (
    <AigendaLogoMark size={size} parentGroup={parentGroup} />
  )

  if (markOnly) {
    return <div className={cn("inline-flex", className)}>{mark}</div>
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-8 text-primary",
        className
      )}
    >
      {mark}

      {showWordmark ? (
        <div className="group flex cursor-pointer items-baseline gap-0">
          <span className="text-6xl font-bold tracking-tight text-primary transition-all duration-300 group-hover:tracking-normal">
            AI
          </span>
          <span className="text-6xl font-bold tracking-tight text-foreground/60 transition-colors duration-300 group-hover:text-foreground">
            genda
          </span>
        </div>
      ) : null}

      {showTagline ? (
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Intelligent Productivity
        </p>
      ) : null}
    </div>
  )
}
