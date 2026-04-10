import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import { Geist_Mono, Public_Sans, IBM_Plex_Sans, Roboto } from "next/font/google";

import "./globals.css";
import { AppProviders } from "./providers";
import { cn } from "@/lib/utils";

const roboto = Roboto({subsets:['latin'],variable:'--font-sans'});

const geistMono = Geist_Mono({subsets:['latin'],variable:'--font-mono'});

export const metadata: Metadata = {
  title: "Aigenda",
  description: "Intelligent productivity — plan and stay on track with Convex + Clerk",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("antialiased", geistMono.variable, "font-sans", roboto.variable)}>
      {/* suppressHydrationWarning: e.g. Cursor/VS Code injects `vsc-initialized` on <body> before hydrate */}
      <body suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
