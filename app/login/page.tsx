"use client";

import { useAuth } from "@/components/auth-context";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Login() {
  const { user, loading, signInWithOAuth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <main className="flex h-dvh w-dvw items-center justify-center">
        <span className="text-muted-foreground">Loading...</span>
      </main>
    );
  }

  if (user) {
    return null;
  }

  return (
    <main className="flex h-dvh w-dvw items-center justify-center">
      <Button
        onClick={() =>
          signInWithOAuth({
            provider: "keycloak",
            scopes: "openid",
          })
        }
      >
        Login
      </Button>
    </main>
  );
}
