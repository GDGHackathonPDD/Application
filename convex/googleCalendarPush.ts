"use node";

import { action } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import {
  AIGENDA_CALENDAR_NAME,
  getOrCreateAiGendaCalendar,
} from "./lib/googleAiGendaCalendar";
import { GOOGLE_CALENDAR_SCOPE_FULL } from "./lib/googleCalendarScopes";
import { decryptToken } from "./lib/tokenCrypto";

const PRIVATE_EXT_FILTER = ["aigenda=v1"] as const;

const pushEventValidator = v.object({
  uid: v.string(),
  summary: v.string(),
  description: v.optional(v.string()),
  kind: v.union(v.literal("timed"), v.literal("allday")),
  startDateTime: v.optional(v.string()),
  endDateTime: v.optional(v.string()),
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
});

function validateEventPayload(
  e: {
    kind: "timed" | "allday";
    startDateTime?: string;
    endDateTime?: string;
    startDate?: string;
    endDate?: string;
  }
): void {
  if (e.kind === "timed") {
    if (!e.startDateTime || !e.endDateTime) {
      throw new ConvexError({
        message: "Invalid timed event payload.",
        code: "INVALID_PUSH_EVENT",
      });
    }
  } else {
    if (!e.startDate || !e.endDate) {
      throw new ConvexError({
        message: "Invalid all-day event payload.",
        code: "INVALID_PUSH_EVENT",
      });
    }
  }
}

async function deletePreviousAiGendaEvents(
  cal: ReturnType<typeof google.calendar>,
  calendarId: string
): Promise<void> {
  let pageToken: string | undefined;
  const ids: string[] = [];
  do {
    const res = await cal.events.list({
      calendarId,
      privateExtendedProperty: [...PRIVATE_EXT_FILTER],
      maxResults: 2500,
      pageToken,
      singleEvents: true,
    });
    for (const ev of res.data.items ?? []) {
      if (ev.id) ids.push(ev.id);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  for (const eventId of ids) {
    await cal.events.delete({ calendarId, eventId });
  }
}

export const pushSchedule = action({
  args: {
    timeZone: v.string(),
    events: v.array(pushEventValidator),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: true;
    data: { inserted: number; calendarId: string };
  }> => {
    if (args.events.length > 5000) {
      throw new ConvexError({
        message: "Too many events in one sync (max 5000).",
        code: "PUSH_TOO_MANY_EVENTS",
      });
    }

    for (const e of args.events) {
      validateEventPayload(e);
    }

    const ctxData = await ctx.runQuery(internal.googleCalendar.getSyncContextForAction, {});
    if (!ctxData) {
      throw new ConvexError({
        message: "Connect Google Calendar first (Setup or Schedule → connect).",
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

    let calendarId: string;
    try {
      calendarId = await getOrCreateAiGendaCalendar(cal, ctxData.aigendaCalendarId);
      if (calendarId !== ctxData.aigendaCalendarId) {
        await ctx.runMutation(internal.googleCalendar.setAigendaCalendarId, {
          settingsId: ctxData.settingsId,
          calendarId,
        });
      }

      await deletePreviousAiGendaEvents(cal, calendarId);

      const privateExt = { aigenda: "v1" };
      let inserted = 0;

      for (const e of args.events) {
        const body: calendar_v3.Schema$Event = {
          summary: e.summary,
          extendedProperties: { private: privateExt },
        };
        if (e.description) {
          body.description = e.description;
        }
        if (e.kind === "timed") {
          body.start = {
            dateTime: e.startDateTime!,
            timeZone: args.timeZone,
          };
          body.end = {
            dateTime: e.endDateTime!,
            timeZone: args.timeZone,
          };
        } else {
          body.start = { date: e.startDate! };
          body.end = { date: e.endDate! };
        }

        await cal.events.insert({
          calendarId,
          requestBody: body,
        });
        inserted++;
      }

      await ctx.runMutation(internal.googleCalendar.patchPushResult, {
        settingsId: ctxData.settingsId,
        ok: true,
        status: `ok: ${inserted} events in ${AIGENDA_CALENDAR_NAME}`,
      });

      return {
        success: true as const,
        data: { inserted, calendarId },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.googleCalendar.patchPushResult, {
        settingsId: ctxData.settingsId,
        ok: false,
        status: `push_error: ${message.slice(0, 400)}`,
      });
      throw new ConvexError({
        message: `Google Calendar push failed: ${message}`,
        code: "GOOGLE_CALENDAR_PUSH",
      });
    }
  },
});
