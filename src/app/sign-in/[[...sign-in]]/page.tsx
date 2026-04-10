import type { Metadata } from "next";
import { Suspense } from "react";

import { SignInForm } from "@/components/auth/sign-in-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Sign In",
  robots: { index: false, follow: false },
};

function SignInFallback() {
  return (
    <div className="bg-background flex min-h-screen flex-1 items-center justify-center p-6">
      <div className="bg-card h-[320px] w-full max-w-md animate-pulse rounded-xl ring-1 ring-foreground/10" />
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="bg-background relative flex min-h-screen flex-1 flex-col items-center justify-center p-6">
      <div className="absolute top-4 right-4 z-10 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>
      <Suspense fallback={<SignInFallback />}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
