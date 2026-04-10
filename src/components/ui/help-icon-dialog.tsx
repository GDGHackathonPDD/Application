"use client"

import * as React from "react"
import { QuestionIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type HelpIconDialogProps = {
  title: React.ReactNode
  /** Shown as the (?) control’s accessible name. */
  triggerLabel: string
  /** Optional screen-reader summary when the body is long or visual-only. */
  description?: string
  children: React.ReactNode
  contentClassName?: string
  triggerClassName?: string
}

/**
 * Small “?” trigger that opens a {@link Dialog} — reuse for feature help without
 * duplicating Dialog + button wiring.
 */
export function HelpIconDialog({
  title,
  triggerLabel,
  description,
  children,
  contentClassName,
  triggerClassName,
}: HelpIconDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={cn(
            "text-muted-foreground hover:text-foreground size-6 shrink-0 rounded-full",
            triggerClassName
          )}
          aria-label={triggerLabel}
        >
          <QuestionIcon className="size-4" weight="bold" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className={cn("gap-4", contentClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription className="sr-only">{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
