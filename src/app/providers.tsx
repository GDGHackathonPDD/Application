"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { shadcn } from "@clerk/themes";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { ConvexProvisionProvider } from "@/components/convex-provision-context";
import { ThemeProvider } from "@/components/theme-provider";

const clerkAppearance = {
  baseTheme: shadcn,
  variables: {
    borderRadius: "var(--radius)",
    colorBorder: "var(--border)",
  },
};

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://build-placeholder.convex.cloud";

const convex = new ConvexReactClient(convexUrl);

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ConvexProvisionProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </ConvexProvisionProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
