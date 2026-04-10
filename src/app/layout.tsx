import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import { Analytics } from "@vercel/analytics/next";
import { Geist_Mono, Roboto } from "next/font/google";

import "./globals.css";
import { AppProviders } from "./providers";
import { cn } from "@/lib/utils";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aigenda.app";

const roboto = Roboto({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AiGenda — AI-Powered Productivity Planning",
    template: "%s | AiGenda",
  },
  description:
    "AiGenda helps you plan smarter with AI-powered scheduling, task management, and calendar integration. Stay on track and beat overload.",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "AiGenda — AI-Powered Productivity Planning",
    description:
      "AiGenda helps you plan smarter with AI-powered scheduling, task management, and calendar integration.",
    url: siteUrl,
    siteName: "AiGenda",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AiGenda — AI-Powered Productivity Planning",
    description:
      "AiGenda helps you plan smarter with AI-powered scheduling, task management, and calendar integration.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        geistMono.variable,
        "font-sans",
        roboto.variable,
      )}
    >
      {/* suppressHydrationWarning: e.g. Cursor/VS Code injects `vsc-initialized` on <body> before hydrate */}
      <body suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
        <Analytics />
      </body>
    </html>
  );
}
