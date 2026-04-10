"use client"

import { HelpIconDialog } from "@/components/ui/help-icon-dialog"

const AIGENDA_CALENDAR_NAME = "AiGenda Calendar"

/** Help (?) for Google import/export — only uses AiGenda Calendar. */
export function AiGendaCalendarHelpTrigger() {
  return (
    <HelpIconDialog
      title={AIGENDA_CALENDAR_NAME}
      triggerLabel={`About ${AIGENDA_CALENDAR_NAME}`}
      description="How Google Calendar import and export use the AiGenda calendar only."
    >
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          <span className="text-foreground font-medium">Import</span> and{" "}
          <span className="text-foreground font-medium">export</span> only read and write
          the <strong className="text-foreground">{AIGENDA_CALENDAR_NAME}</strong> calendar
          in your Google account. Your other calendars are not accessed.
        </p>
        <p>
          If {AIGENDA_CALENDAR_NAME} does not exist yet, the app creates it the first time
          you import or sync. Export replaces events in that calendar for the selected
          schedule window; import turns events there into tasks.
        </p>
      </div>
    </HelpIconDialog>
  )
}
