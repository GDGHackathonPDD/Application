"use client";

import * as React from "react";
import { useUser } from "@clerk/nextjs";
import {
  IconBrandGoogle,
  IconDotsVertical,
  IconLoader2,
  IconShield,
  IconUser,
} from "@tabler/icons-react";

import { getClerkErrorMessage } from "@/lib/clerk-errors";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function initials(user: {
  firstName: string | null;
  lastName: string | null;
  primaryEmailAddress: { emailAddress: string } | null;
}): string {
  const a = user.firstName?.trim();
  const b = user.lastName?.trim();
  if (a && b) {
    return `${a[0]}${b[0]}`.toUpperCase();
  }
  if (a) {
    return a.slice(0, 2).toUpperCase();
  }
  const e = user.primaryEmailAddress?.emailAddress;
  return e ? e.slice(0, 2).toUpperCase() : "?";
}

export function AccountSettings() {
  const { user, isLoaded } = useUser();
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [pendingProfile, setPendingProfile] = React.useState(false);

  const [newEmail, setNewEmail] = React.useState("");
  const [emailCode, setEmailCode] = React.useState("");
  const [pendingEmailId, setPendingEmailId] = React.useState<string | null>(
    null,
  );
  const [pendingEmail, setPendingEmail] = React.useState(false);

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [pendingPassword, setPendingPassword] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName ?? "");
    setLastName(user.lastName ?? "");
    setUsername(user.username ?? "");
  }, [user]);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const onSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    clearMessages();
    setPendingProfile(true);
    try {
      await user.update({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });
      setSuccess("Profile updated.");
    } catch (err) {
      setError(getClerkErrorMessage(err));
    } finally {
      setPendingProfile(false);
    }
  };

  const onSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    clearMessages();
    setPendingProfile(true);
    try {
      await user.update({ username: username.trim() || undefined });
      setSuccess("Username updated.");
    } catch (err) {
      setError(getClerkErrorMessage(err));
    } finally {
      setPendingProfile(false);
    }
  };

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    clearMessages();
    setPendingProfile(true);
    try {
      await user.setProfileImage({ file });
      setSuccess("Profile photo updated.");
    } catch (err) {
      setError(getClerkErrorMessage(err));
    } finally {
      setPendingProfile(false);
    }
  };

  const onAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newEmail.trim()) return;
    clearMessages();
    setPendingEmail(true);
    try {
      const created = await user.createEmailAddress({ email: newEmail.trim() });
      if (created.verification?.status === "verified") {
        setNewEmail("");
        setSuccess("Email added.");
        return;
      }
      await created.prepareVerification({ strategy: "email_code" });
      setPendingEmailId(created.id);
      setNewEmail("");
      setSuccess("Enter the code we sent to verify this email.");
    } catch (err) {
      setError(getClerkErrorMessage(err));
    } finally {
      setPendingEmail(false);
    }
  };

  const onVerifyNewEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pendingEmailId || !emailCode.trim()) return;
    const addr = user.emailAddresses.find((a) => a.id === pendingEmailId);
    if (!addr) {
      setError("Email was removed. Add it again.");
      setPendingEmailId(null);
      return;
    }
    clearMessages();
    setPendingEmail(true);
    try {
      await addr.attemptVerification({ code: emailCode.trim() });
      setEmailCode("");
      setPendingEmailId(null);
      setSuccess("Email verified.");
    } catch (err) {
      setError(getClerkErrorMessage(err));
    } finally {
      setPendingEmail(false);
    }
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    clearMessages();
    setPendingPassword(true);
    try {
      await user.updatePassword({
        currentPassword: currentPassword || undefined,
        newPassword,
        signOutOfOtherSessions: false,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password updated.");
    } catch (err) {
      setError(getClerkErrorMessage(err));
    } finally {
      setPendingPassword(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <IconLoader2
          className="text-muted-foreground size-8 animate-spin"
          aria-hidden
        />
      </div>
    );
  }

  if (!user) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Not signed in</AlertTitle>
        <AlertDescription>Sign in to manage your account.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      {error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {success ? (
        <Alert className="mb-6">
          <AlertTitle>Done</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs
        defaultValue="profile"
        orientation="vertical"
        className="flex w-full flex-col gap-8 md:flex-row md:items-start md:gap-10"
      >
        <div className="md:w-52 shrink-0">
          <div className="mb-4">
            <h1 className="font-heading text-lg font-semibold tracking-tight">
              Account
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage your account info.
            </p>
          </div>
          <TabsList
            variant="line"
            className="flex w-full flex-col gap-0.5 bg-transparent p-0"
          >
            <TabsTrigger value="profile" className="w-full justify-start gap-2">
              <IconUser className="size-4" aria-hidden />
              Profile
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="w-full justify-start gap-2"
            >
              <IconShield className="size-4" aria-hidden />
              Security
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="min-w-0 flex-1 space-y-6">
          <TabsContent value="profile" className="mt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>
                  Photo and name shown in Aigenda.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <div className="flex flex-col items-start gap-3">
                  <Avatar size="lg" className="size-20">
                    <AvatarImage
                      src={user.imageUrl}
                      alt={
                        `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
                        "User avatar"
                      }
                    />
                    <AvatarFallback className="text-lg">
                      {initials(user)}
                    </AvatarFallback>
                  </Avatar>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={onAvatarChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pendingProfile}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {pendingProfile ? (
                      <IconLoader2
                        className="size-4 animate-spin"
                        aria-hidden
                      />
                    ) : (
                      "Update photo"
                    )}
                  </Button>
                </div>
                <form
                  onSubmit={onSaveProfile}
                  className="flex min-w-0 flex-1 flex-col gap-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="acc-first">First name</Label>
                      <Input
                        id="acc-first"
                        value={firstName}
                        onChange={(ev) => {
                          clearMessages();
                          setFirstName(ev.target.value);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="acc-last">Last name</Label>
                      <Input
                        id="acc-last"
                        value={lastName}
                        onChange={(ev) => {
                          clearMessages();
                          setLastName(ev.target.value);
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={pendingProfile}>
                      {pendingProfile ? (
                        <IconLoader2
                          className="size-4 animate-spin"
                          aria-hidden
                        />
                      ) : (
                        "Save profile"
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Username</CardTitle>
                <CardDescription>Your unique handle.</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={onSaveUsername}
                  className="flex flex-col gap-4 sm:flex-row sm:items-end"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Label htmlFor="acc-user">Username</Label>
                    <Input
                      id="acc-user"
                      value={username}
                      onChange={(ev) => {
                        clearMessages();
                        setUsername(ev.target.value);
                      }}
                      autoComplete="username"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="shrink-0"
                    disabled={pendingProfile}
                  >
                    {pendingProfile ? (
                      <IconLoader2
                        className="size-4 animate-spin"
                        aria-hidden
                      />
                    ) : (
                      "Update username"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email addresses</CardTitle>
                <CardDescription>
                  Used for sign-in and notifications.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <ul className="flex flex-col gap-2">
                  {user.emailAddresses.map((em) => {
                    const isPrimary = user.primaryEmailAddressId === em.id;
                    return (
                      <li
                        key={em.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate text-sm">
                            {em.emailAddress}
                          </span>
                          {isPrimary ? (
                            <Badge variant="secondary" className="shrink-0">
                              Primary
                            </Badge>
                          ) : null}
                          {em.verification?.status !== "verified" ? (
                            <Badge variant="outline" className="shrink-0">
                              Unverified
                            </Badge>
                          ) : null}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Email actions"
                            >
                              <IconDotsVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!isPrimary &&
                            em.verification?.status === "verified" ? (
                              <DropdownMenuItem
                                onSelect={(ev) => {
                                  ev.preventDefault();
                                  clearMessages();
                                  void user
                                    .update({ primaryEmailAddressId: em.id })
                                    .then(() =>
                                      setSuccess("Primary email updated."),
                                    )
                                    .catch((err) =>
                                      setError(getClerkErrorMessage(err)),
                                    );
                                }}
                              >
                                Make primary
                              </DropdownMenuItem>
                            ) : null}
                            {!isPrimary ? (
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={(ev) => {
                                  ev.preventDefault();
                                  clearMessages();
                                  void em
                                    .destroy()
                                    .then(() => setSuccess("Email removed."))
                                    .catch((err) =>
                                      setError(getClerkErrorMessage(err)),
                                    );
                                }}
                              >
                                Remove
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </li>
                    );
                  })}
                </ul>

                <Separator />

                <form onSubmit={onAddEmail} className="flex flex-col gap-2">
                  <Label htmlFor="acc-new-email">Add email address</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="acc-new-email"
                      type="email"
                      placeholder="you@example.com"
                      value={newEmail}
                      onChange={(ev) => {
                        clearMessages();
                        setNewEmail(ev.target.value);
                      }}
                      disabled={!!pendingEmailId || pendingEmail}
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={pendingEmail || !!pendingEmailId}
                    >
                      {pendingEmail ? (
                        <IconLoader2
                          className="size-4 animate-spin"
                          aria-hidden
                        />
                      ) : (
                        "Add email"
                      )}
                    </Button>
                  </div>
                </form>

                {pendingEmailId ? (
                  <form
                    onSubmit={onVerifyNewEmail}
                    className="flex flex-col gap-2 rounded-lg bg-muted/40 p-4"
                  >
                    <Label htmlFor="acc-email-code">Verification code</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id="acc-email-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={emailCode}
                        onChange={(ev) => {
                          clearMessages();
                          setEmailCode(ev.target.value);
                        }}
                      />
                      <Button type="submit" disabled={pendingEmail}>
                        {pendingEmail ? (
                          <IconLoader2
                            className="size-4 animate-spin"
                            aria-hidden
                          />
                        ) : (
                          "Verify"
                        )}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      onClick={() => {
                        setPendingEmailId(null);
                        setEmailCode("");
                        clearMessages();
                      }}
                    >
                      Cancel
                    </Button>
                  </form>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Connected accounts</CardTitle>
                <CardDescription>
                  Social sign-in linked to your profile.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {user.externalAccounts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No connected accounts.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {user.externalAccounts.map((ex) => (
                      <li
                        key={ex.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          {ex.provider === "google" ? (
                            <IconBrandGoogle
                              className="size-4 shrink-0"
                              aria-hidden
                            />
                          ) : null}
                          <span className="text-sm">{ex.providerTitle()}</span>
                          <span className="text-muted-foreground truncate text-sm">
                            {ex.emailAddress}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="mt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>
                  {user.passwordEnabled
                    ? "Change the password you use with email sign-in."
                    : "You sign in with a social provider only — no password on file."}
                </CardDescription>
              </CardHeader>
              {user.passwordEnabled ? (
                <form onSubmit={onChangePassword}>
                  <CardContent>
                    <div className="flex max-w-md flex-col gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="acc-cur-pw">Current password</Label>
                        <Input
                          id="acc-cur-pw"
                          type="password"
                          autoComplete="current-password"
                          value={currentPassword}
                          onChange={(ev) => {
                            clearMessages();
                            setCurrentPassword(ev.target.value);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="acc-new-pw">New password</Label>
                        <Input
                          id="acc-new-pw"
                          type="password"
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={(ev) => {
                            clearMessages();
                            setNewPassword(ev.target.value);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="acc-confirm-pw">
                          Confirm new password
                        </Label>
                        <Input
                          id="acc-confirm-pw"
                          type="password"
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(ev) => {
                            clearMessages();
                            setConfirmPassword(ev.target.value);
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="justify-end">
                    <Button type="submit" disabled={pendingPassword}>
                      {pendingPassword ? (
                        <IconLoader2
                          className="size-4 animate-spin"
                          aria-hidden
                        />
                      ) : (
                        "Update password"
                      )}
                    </Button>
                  </CardFooter>
                </form>
              ) : null}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Two-factor authentication</CardTitle>
                <CardDescription>
                  Extra protection for your account.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p>
                  <span className="text-muted-foreground">
                    Authenticator app:{" "}
                  </span>
                  {user.totpEnabled ? (
                    <span className="text-foreground">On</span>
                  ) : (
                    <span className="text-muted-foreground">Off</span>
                  )}
                </p>
                <p>
                  <span className="text-muted-foreground">Backup codes: </span>
                  {user.backupCodeEnabled ? (
                    <span className="text-foreground">Enabled</span>
                  ) : (
                    <span className="text-muted-foreground">Not set up</span>
                  )}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
