"use node";

import { action } from "./_generated/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { colorForUid } from "./lib/canvas/ics";
import { getOrCreateAiGendaCalendar } from "./lib/googleAiGendaCalendar";
import { GOOGLE_CALENDAR_SCOPE_FULL } from "./lib/googleCalendarScopes";
import { decryptToken } from "./lib/tokenCrypto";

function eventToDueDate(event: {
  start?: { date?: string | null; dateTime?: string | null } | null;
}): string | null {
  const start = event.start;
  if (!start) return null;
  if (start.date) return start.date;
  if (start.dateTime) return start.dateTime.slice(0, 10);
  return null;
}

export const sync = action({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    success: true;
    data: { synced: number; total_events: number };
  }> => {
    const ctxData = await ctx.runQuery(internal.googleCalendar.getSyncContextForAction, {});
    if (!ctxData) {
      throw new ConvexError({
        message: "Connect Google Calendar first (Setup → Google Calendar).",
        code: "GOOGLE_NOT_CONNECTED",
      });
    }

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new ConvexError({
        message: "Server missing Google OAuth client configuration.",
        code: "GOOGLE_OAUTH_MISCONFIGURED",
      });
    }

    let refreshToken: string;
    try {
      refreshToken = await decryptToken(ctxData.encryptedRefreshToken);
    } catch (e) {
      throw new ConvexError({
        message: e instanceof Error ? e.message : "Failed to decrypt stored token",
        code: "GOOGLE_TOKEN_DECRYPT",
      });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
      scope: GOOGLE_CALENDAR_SCOPE_FULL,
    });

    const cal = google.calendar({ version: "v3", auth: oauth2Client });

    const timeMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

    let eventItems: calendar_v3.Schema$Event[] = [];

    try {
      const calendarId = await getOrCreateAiGendaCalendar(
        cal,
        ctxData.aigendaCalendarId
      );
      if (calendarId !== ctxData.aigendaCalendarId) {
        await ctx.runMutation(internal.googleCalendar.setAigendaCalendarId, {
          settingsId: ctxData.settingsId,
          calendarId,
        });
      }

      const res = await cal.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        maxResults: 2500,
        orderBy: "startTime",
      });
      eventItems = (res.data?.items ?? []) as calendar_v3.Schema$Event[];
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.googleCalendar.patchGoogleSyncError, {
        settingsId: ctxData.settingsId,
        message,
      });
      throw new ConvexError({
        message: `Google Calendar API error: ${message}`,
        code: "GOOGLE_CALENDAR_API",
      });
    }

    const payload: {
      uid: string;
      summary: string;
      dueDate: string;
      color: string;
    }[] = [];

    for (const event of eventItems) {
      if (!event) continue;
      const id = event.id ?? event.iCalUID;
      if (!id) continue;
      const dueDate = eventToDueDate(event);
      if (!dueDate) continue;
      const summary = (event.summary ?? "Untitled event").trim();
      const uid = `gcal:${id}`;
      payload.push({
        uid,
        summary,
        dueDate,
        color: colorForUid(uid),
      });
    }

    const { upserted } = await ctx.runMutation(internal.googleCalendar.applyGoogleCalendarSync, {
      userId: ctxData.userId,
      settingsId: ctxData.settingsId,
      events: payload,
    });

    return {
      success: true as const,
      data: { synced: upserted, total_events: eventItems.length },
    };
  },
});
