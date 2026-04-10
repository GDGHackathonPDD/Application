import type { Metadata } from "next";
import { AccountSettings } from "@/components/account/account-settings";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <AccountSettings />;
}
