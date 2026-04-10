"use client"

import { format } from "date-fns/format"
import { useMemo, useState } from "react"
import type { Matcher } from "react-day-picker"
import { CalendarBlankIcon, CaretDownIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { dateToIso, parseIsoToLocalDate } from "@/lib/iso-date"
import { cn } from "@/lib/utils"

export function IsoDatePicker({
  value,
  onChange,
  id,
  disabledBefore,
  disabledAfter,
  buttonClassName,
  "aria-invalid": ariaInvalid,
  align = "start",
}: {
  value: string
  onChange: (isoDate: string) => void
  id?: string
  /** Inclusive lower bound: days strictly before this ISO date are disabled. */
  disabledBefore?: string
  /** Inclusive upper bound: days strictly after this ISO date are disabled. */
  disabledAfter?: string
  buttonClassName?: string
  "aria-invalid"?: boolean
  align?: "start" | "center" | "end"
}) {
  const [open, setOpen] = useState(false)
  const selected = parseIsoToLocalDate(value)

  const disabled = useMemo((): Matcher | Matcher[] | undefined => {
    const matchers: Matcher[] = []
    if (disabledBefore) {
      matchers.push({ before: parseIsoToLocalDate(disabledBefore) })
    }
    if (disabledAfter) {
      matchers.push({ after: parseIsoToLocalDate(disabledAfter) })
    }
    if (matchers.length === 0) return undefined
    if (matchers.length === 1) return matchers[0]
    return matchers
  }, [disabledBefore, disabledAfter])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={ariaInvalid}
          className={cn(
            "justify-between gap-2 font-normal tabular-nums",
            buttonClassName
          )}
          aria-label="Choose date"
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarBlankIcon
              className="size-4 shrink-0 opacity-70"
              aria-hidden
            />
            <span className="truncate">{format(selected, "MMM d, yyyy")}</span>
          </span>
          <CaretDownIcon className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          key={value}
          mode="single"
          selected={selected}
          defaultMonth={selected}
          disabled={disabled}
          onSelect={(d) => {
            if (!d) return
            onChange(dateToIso(d))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
