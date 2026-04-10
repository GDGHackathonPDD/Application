"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerk, useSignUp } from "@clerk/nextjs";
import { ChevronRight, Eye, EyeOff, Loader2 } from "lucide-react";

import { getClerkErrorMessage } from "@/lib/clerk-errors";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const AFTER_AUTH = "/setup";

function useAuthOrigin() {
  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return origin;
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function SignUpForm() {
  const router = useRouter();
  const { signUp, isLoaded } = useSignUp();
  const { setActive } = useClerk();
  const origin = useAuthOrigin();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<"oauth" | "signup" | "verify" | null>(null);
  const [step, setStep] = React.useState<"form" | "verify-email">("form");

  const redirectUrl = origin ? `${origin}/sso-callback` : "";
  const redirectUrlComplete = origin ? `${origin}${AFTER_AUTH}` : "";

  const completeSignUp = React.useCallback(
    async (sessionId: string | null) => {
      if (!sessionId) {
        setError("Could not create a session. Please try again.");
        return;
      }
      await setActive({ session: sessionId });
      router.push(AFTER_AUTH);
    },
    [router, setActive],
  );

  const onGoogle = async () => {
    if (!isLoaded || !signUp || !redirectUrl) return;
    setError(null);
    setPending("oauth");
    try {
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl,
        redirectUrlComplete,
      });
    } catch (err) {
      setError(getClerkErrorMessage(err));
      setPending(null);
    }
  };

  const onSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;
    setError(null);
    setPending("signup");
    try {
      const result = await signUp.create({
        emailAddress: email.trim(),
        password,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await completeSignUp(result.createdSessionId);
        return;
      }

      const needsEmailVerify =
        result.unverifiedFields?.includes("email_address") ||
        result.verifications?.emailAddress?.status === "unverified";

      if (result.status === "missing_requirements" && needsEmailVerify) {
        await result.prepareEmailAddressVerification({ strategy: "email_code" });
        setStep("verify-email");
        return;
      }

      setError("Additional steps are required in the Clerk dashboard for this sign-up flow.");
    } catch (err) {
      setError(getClerkErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const onVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;
    setError(null);
    setPending("verify");
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });
      if (result.status === "complete" && result.createdSessionId) {
        await completeSignUp(result.createdSessionId);
        return;
      }
      setError("Could not verify your email. Check the code and try again.");
    } catch (err) {
      setError(getClerkErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  if (!isLoaded) {
    return (
      <Card className="w-full max-w-md border-border/80 shadow-md">
        <CardContent className="flex min-h-[280px] items-center justify-center pt-6">
          <Loader2 className="text-muted-foreground size-8 animate-spin" aria-hidden />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md border-border/80 shadow-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Create account</CardTitle>
        <CardDescription>Sign up to start planning with Aigenda.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {step === "form" ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full gap-2"
              disabled={!redirectUrl || pending === "oauth"}
              onClick={onGoogle}
            >
              {pending === "oauth" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <GoogleIcon className="size-4 shrink-0" />
              )}
              Continue with Google
            </Button>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-muted-foreground text-xs font-medium uppercase">or</span>
              <Separator className="flex-1" />
            </div>

            <form onSubmit={onSignUpSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sign-up-email">Email</Label>
                <Input
                  id="sign-up-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={pending === "signup"}
                  aria-invalid={!!error}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sign-up-password">Password</Label>
                <div className="relative">
                  <Input
                    id="sign-up-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={pending === "signup"}
                    className="pr-10"
                    aria-invalid={!!error}
                  />
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="h-10 w-full gap-1"
                disabled={pending === "signup"}
              >
                {pending === "signup" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <>
                    Continue
                    <ChevronRight className="size-4" aria-hidden />
                  </>
                )}
              </Button>
            </form>
          </>
        ) : (
          <form onSubmit={onVerifySubmit} className="space-y-4">
            <p className="text-muted-foreground text-sm">
              We sent a verification code to <span className="text-foreground font-medium">{email}</span>.
            </p>
            <div className="space-y-2">
              <Label htmlFor="sign-up-code">Verification code</Label>
              <Input
                id="sign-up-code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                disabled={pending === "verify"}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setStep("form");
                  setCode("");
                  setError(null);
                }}
              >
                Back
              </Button>
              <Button type="submit" className="flex-1 gap-1" disabled={pending === "verify"}>
                {pending === "verify" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  "Verify email"
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 border-t pt-6">
        <p className="text-muted-foreground text-center text-sm">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-primary font-medium underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
