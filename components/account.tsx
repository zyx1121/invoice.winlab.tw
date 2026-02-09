"use client";

import { useAuth } from "@/components/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Account() {
  const { user } = useAuth();

  return (
    <div className="fixed top-4 right-4 z-50">
      <Avatar>
        <AvatarImage
          src={user?.user_metadata?.avatar_url}
          alt={user?.email}
        />
        <AvatarFallback>
          {user?.email?.charAt(0).toUpperCase() || "U"}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
