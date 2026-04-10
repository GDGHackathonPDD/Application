"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerk, useSignIn } from "@clerk/nextjs";
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

export function SignInForm() {
  const router = useRouter();
  const { signIn, isLoaded } = useSignIn();
  const { setActive } = useClerk();
  const origin = useAuthOrigin();

  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [mfaCode, setMfaCode] = React.useState("");
  const [secondFactorStrategy, setSecondFactorStrategy] = React.useState<
    "totp" | "phone_code" | "backup_code" | null
  >(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<"oauth" | "password" | "mfa" | null>(null);
  const [step, setStep] = React.useState<"password" | "second_factor">("password");

  const redirectUrl = origin ? `${origin}/sso-callback` : "";
  const redirectUrlComplete = origin ? `${origin}${AFTER_AUTH}` : "";

  const completeSignIn = React.useCallback(
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
    if (!isLoaded || !signIn || !redirectUrl) return;
    setError(null);
    setPending("oauth");
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl,
        redirectUrlComplete,
      });
    } catch (err) {
      setError(getClerkErrorMessage(err));
      setPending(null);
    }
  };

  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    setError(null);
    setPending("password");
    try {
      const result = await signIn.create({
        strategy: "password",
        identifier: identifier.trim(),
        password,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await completeSignIn(result.createdSessionId);
        return;
      }

      if (result.status === "needs_second_factor") {
        const factors = signIn.supportedSecondFactors ?? [];
        const primary = factors[0];
        const strategy = primary?.strategy;
        if (strategy === "phone_code" && primary && "phoneNumberId" in primary) {
          await signIn.prepareSecondFactor({
            strategy: "phone_code",
            phoneNumberId: primary.phoneNumberId,
          });
        }
        if (strategy === "totp" || strategy === "phone_code" || strategy === "backup_code") {
          setSecondFactorStrategy(strategy);
        } else {
          setSecondFactorStrategy("totp");
        }
        setStep("second_factor");
        setPending(null);
        return;
      }

      setError("Sign-in could not be completed. Try again or use another method.");
    } catch (err) {
      setError(getClerkErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const onMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn || !secondFactorStrategy) return;
    setError(null);
    setPending("mfa");
    const code = mfaCode.trim();
    try {
      const result = await signIn.attemptSecondFactor(
        secondFactorStrategy === "backup_code"
          ? { strategy: "backup_code", code }
          : secondFactorStrategy === "phone_code"
            ? { strategy: "phone_code", code }
            : { strategy: "totp", code },
      );
      if (result.status === "complete" && result.createdSessionId) {
        await completeSignIn(result.createdSessionId);
        return;
      }
      setError("Verification failed. Check your code and try again.");
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
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Welcome back. Use your account to continue.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not sign you in</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {step === "password" ? (
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

            <form onSubmit={onPasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sign-in-identifier">Email or username</Label>
                <Input
                  id="sign-in-identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  disabled={pending === "password"}
                  aria-invalid={!!error}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sign-in-password">Password</Label>
                <div className="relative">
                  <Input
                    id="sign-in-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={pending === "password"}
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
                disabled={pending === "password"}
              >
                {pending === "password" ? (
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
          <form onSubmit={onMfaSubmit} className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {secondFactorStrategy === "phone_code"
                ? "Enter the code we sent to your phone to finish signing in."
                : secondFactorStrategy === "backup_code"
                  ? "Enter a backup code to finish signing in."
                  : "Enter the code from your authenticator app to finish signing in."}
            </p>
            <div className="space-y-2">
              <Label htmlFor="sign-in-mfa">
                {secondFactorStrategy === "phone_code"
                  ? "SMS code"
                  : secondFactorStrategy === "backup_code"
                    ? "Backup code"
                    : "Authenticator code"}
              </Label>
              <Input
                id="sign-in-mfa"
                name="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                required
                disabled={pending === "mfa"}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setStep("password");
                  setMfaCode("");
                  setSecondFactorStrategy(null);
                  setError(null);
                }}
              >
                Back
              </Button>
              <Button type="submit" className="flex-1 gap-1" disabled={pending === "mfa"}>
                {pending === "mfa" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  "Verify"
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 border-t pt-6">
        <p className="text-muted-foreground text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="text-primary font-medium underline-offset-4 hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
