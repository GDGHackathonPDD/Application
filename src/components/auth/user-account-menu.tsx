"use client";

import * as React from "react";
import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";
import { IconLogout, IconSettings } from "@tabler/icons-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initialsFromUser(user: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  primaryEmailAddress: { emailAddress: string } | null;
}): string {
  const first = user.firstName?.trim();
  const last = user.lastName?.trim();
  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }
  if (first) {
    return first.slice(0, 2).toUpperCase();
  }
  const email = user.primaryEmailAddress?.emailAddress;
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  const u = user.username?.trim();
  if (u) {
    return u.slice(0, 2).toUpperCase();
  }
  return "?";
}

function displayName(user: {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  primaryEmailAddress: { emailAddress: string } | null;
}): string {
  if (user.fullName?.trim()) {
    return user.fullName.trim();
  }
  const first = user.firstName?.trim();
  const last = user.lastName?.trim();
  if (first || last) {
    return [first, last].filter(Boolean).join(" ");
  }
  return user.primaryEmailAddress?.emailAddress ?? "Account";
}

export function UserAccountMenu() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  if (!isLoaded) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="size-9 shrink-0 rounded-full"
        disabled
        aria-label="Account menu"
      >
        <span className="bg-muted size-8 animate-pulse rounded-full" />
      </Button>
    );
  }

  if (!user) {
    return null;
  }

  const name = displayName(user);
  const handle = user.username
    ? `@${user.username}`
    : (user.primaryEmailAddress?.emailAddress ?? "");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 rounded-full p-0"
          aria-label="Open account menu"
        >
          <Avatar size="default" className="size-9">
            <AvatarImage src={user.imageUrl} alt={name} />
            <AvatarFallback>{initialsFromUser(user)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="flex gap-2.5 px-2 py-2">
          <Avatar size="default" className="size-10">
            <AvatarImage src={user.imageUrl} alt={name} />
            <AvatarFallback>{initialsFromUser(user)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{name}</span>
            {handle ? (
              <span className="text-muted-foreground truncate text-xs">
                {handle}
              </span>
            ) : null}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account" className="cursor-pointer gap-2">
            <IconSettings
              className="size-4"
              data-icon="inline-start"
              aria-hidden
            />
            Manage account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer gap-2"
          onSelect={(e) => {
            e.preventDefault();
            void signOut({ redirectUrl: "/sign-in" });
          }}
        >
          <IconLogout className="size-4" data-icon="inline-start" aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
