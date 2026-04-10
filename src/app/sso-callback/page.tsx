import type { Metadata } from "next";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "SSO Callback",
  robots: { index: false, follow: false },
};

export default function SSOCallbackPage() {
  return <AuthenticateWithRedirectCallback />;
}
