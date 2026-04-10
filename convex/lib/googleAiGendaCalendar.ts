"use node";

import { ConvexError } from "convex/values";
import { google } from "googleapis";

/** Display name of the secondary calendar used for import + export. */
export const AIGENDA_CALENDAR_NAME = "AiGenda Calendar";

export async function getOrCreateAiGendaCalendar(
  cal: ReturnType<typeof google.calendar>,
  storedId: string | undefined
): Promise<string> {
  if (storedId) {
    try {
      await cal.calendars.get({ calendarId: storedId });
      return storedId;
    } catch {
      /* calendar removed — recreate */
    }
  }

  const listRes = await cal.calendarList.list({ maxResults: 250 });
  const found = listRes.data.items?.find(
    (i) => i.summary === AIGENDA_CALENDAR_NAME
  );
  if (found?.id) {
    return found.id;
  }

  const created = await cal.calendars.insert({
    requestBody: { summary: AIGENDA_CALENDAR_NAME },
  });
  const id = created.data.id;
  if (!id) {
    throw new ConvexError({
      message: "Google did not return a calendar id for AiGenda Calendar.",
      code: "GOOGLE_CALENDAR_CREATE",
    });
  }
  return id;
}
