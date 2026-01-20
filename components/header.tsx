"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";

export function Header() {
  const { user } = useAuth();

  return (
    <header className="flex items-center justify-between p-4 px-6 w-full max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Link href="/">
          <h1 className="text-2xl text-foreground font-bold hover:scale-105 transition-transform duration-200">
            Invoice
          </h1>
        </Link>
      </div>
      {user && (
        <Link
          href="/profile"
          className="transition-all hover:opacity-80 hover:scale-105 duration-200 hover:cursor-pointer"
          aria-label="Profile"
        >
          <Avatar>
            {user.user_metadata?.avatar_url ? (
              <AvatarImage
                src={user.user_metadata.avatar_url}
                alt={user.email || "N/A"}
              />
            ) : null}
            <AvatarFallback>
              {user.user_metadata?.full_name
                ? user.user_metadata.full_name.charAt(0).toUpperCase()
                : ""}
            </AvatarFallback>
          </Avatar>
        </Link>
      )}
    </header>
  );
}
