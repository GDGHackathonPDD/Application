import { Suspense } from "react";

import { SignInForm } from "@/components/auth/sign-in-form";

function SignInFallback() {
  return (
    <div className="bg-background flex min-h-screen flex-1 items-center justify-center p-6">
      <div className="bg-card h-[320px] w-full max-w-md animate-pulse rounded-xl ring-1 ring-foreground/10" />
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="bg-background flex min-h-screen flex-1 flex-col items-center justify-center p-6">
      <Suspense fallback={<SignInFallback />}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
