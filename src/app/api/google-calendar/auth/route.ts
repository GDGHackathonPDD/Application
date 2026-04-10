import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { google } from "googleapis";

import { getAppBaseUrl } from "@/lib/app-url";
import { createOAuthState } from "@/lib/oauth-state";

/** Full Calendar access: read primary calendar (import) + create secondary calendar + write events (AiGenda push). */
const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
];

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", getAppBaseUrl()));
  }

  const returnTo = request.nextUrl.searchParams.get("return_to") ?? undefined;

  let state: string;
  try {
    state = createOAuthState(userId, returnTo ?? undefined);
  } catch {
    return new NextResponse("OAuth state signing failed (check GOOGLE_OAUTH_CLIENT_SECRET).", {
      status: 500,
    });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  let baseUrl: string;
  try {
    baseUrl = getAppBaseUrl();
  } catch {
    return new NextResponse("Missing NEXT_PUBLIC_APP_URL.", { status: 500 });
  }

  if (!clientId || !clientSecret) {
    return new NextResponse(
      "Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET.",
      { status: 500 }
    );
  }

  const redirectUri = `${baseUrl}/api/google-calendar/callback`;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });

  return NextResponse.redirect(url);
}
