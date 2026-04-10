import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { google } from "googleapis";

import { api } from "@convex/_generated/api";
import { getAppBaseUrl } from "@/lib/app-url";
import { verifyOAuthState } from "@/lib/oauth-state";

function redirectToSetupError(baseUrl: string, reason: string) {
  return NextResponse.redirect(
    new URL(`/setup?google_calendar=error&reason=${encodeURIComponent(reason)}`, baseUrl)
  );
}

export async function GET(request: NextRequest) {
  let baseUrl: string;
  try {
    baseUrl = getAppBaseUrl();
  } catch {
    return new NextResponse("Missing NEXT_PUBLIC_APP_URL.", { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;
  const oauthError = searchParams.get("error");
  if (oauthError) {
    return redirectToSetupError(baseUrl, oauthError);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) {
    return redirectToSetupError(baseUrl, "missing_code_or_state");
  }

  const verified = verifyOAuthState(state);
  if (!verified) {
    return redirectToSetupError(baseUrl, "invalid_state");
  }

  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", baseUrl));
  }
  if (verified.sub !== userId) {
    return redirectToSetupError(baseUrl, "state_user_mismatch");
  }

  let token: string | null;
  try {
    token = await getToken({ template: "convex" });
  } catch {
    return redirectToSetupError(
      baseUrl,
      "clerk_jwt_template_convex_missing"
    );
  }
  if (!token) {
    return redirectToSetupError(baseUrl, "no_clerk_jwt");
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirectToSetupError(baseUrl, "oauth_not_configured");
  }

  const redirectUri = `${baseUrl}/api/google-calendar/callback`;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  let refreshToken: string;
  let connectedEmail: string | undefined;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      return redirectToSetupError(baseUrl, "no_refresh_token");
    }
    refreshToken = tokens.refresh_token;
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userinfo } = await oauth2.userinfo.get();
    connectedEmail = userinfo.email ?? undefined;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return redirectToSetupError(baseUrl, msg.slice(0, 200));
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return new NextResponse("Missing NEXT_PUBLIC_CONVEX_URL.", { status: 500 });
  }

  try {
    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(token);
    await convex.mutation(api.googleCalendar.saveRefreshToken, {
      refreshToken,
      connectedEmail,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return redirectToSetupError(baseUrl, `convex: ${msg.slice(0, 200)}`);
  }

  return NextResponse.redirect(new URL("/setup?google_calendar=connected", baseUrl));
}
