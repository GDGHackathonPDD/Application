import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Schedule",
  robots: { index: false, follow: false },
};

export default function ScheduleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
