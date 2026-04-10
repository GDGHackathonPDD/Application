import type { Metadata } from "next";
import { SetupScreen } from "@/components/momentum/setup-screen";

export const metadata: Metadata = {
  title: "Setup",
  robots: { index: false, follow: false },
};

export default function SetupPage() {
  return <SetupScreen />;
}
