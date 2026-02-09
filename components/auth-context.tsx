"use client";

import { createClient } from "@/lib/supabase/client";
import type { Provider, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface SignInWithOAuthOptions {
  provider: Provider;
  redirectTo?: string;
  scopes?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  signInWithOAuth: (options: SignInWithOAuthOptions) => Promise<unknown>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshUser: async () => { },
  signInWithOAuth: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabase] = useState(() => createClient());

  const refreshUser = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    } catch (error) {
      console.error("[Auth] refreshUser failed:", error);
      setUser(null);
    }
  };

  const signInWithOAuth = useCallback(
    async (options: SignInWithOAuthOptions) => {
      const redirectTo =
        options.redirectTo ??
        (typeof window !== "undefined"
          ? `${window.location.origin}/api/auth/callback`
          : "");
      return supabase.auth.signInWithOAuth({
        provider: options.provider,
        options: {
          redirectTo,
          scopes: options.scopes ?? "openid",
        },
      });
    },
    [supabase]
  );

  const isCookieError = (error: any): boolean => {
    const message = error?.message || "";
    return (
      message.includes("Invalid") ||
      message.includes("corrupt") ||
      message.includes("malformed") ||
      message.includes("UTF-8") ||
      message.includes("utf-8")
    );
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("[Auth] getSession error:", error);

          if (error.message.includes("429") || error.message.includes("rate")) {
            console.warn("[Auth] Rate limit detected - waiting before retry");
            return;
          }

          if (isCookieError(error)) {
            console.warn("[Auth] Corrupted cookies:", error.message);
          }
        }

        if (mounted) {
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error("[Auth] initializeAuth failed:", error);

        if (isCookieError(error)) {
          console.warn("[Auth] Clearing corrupted cookies");
        }

        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state changed:", event);

      if (event === "TOKEN_REFRESHED") {
        console.log("Token refreshed successfully");
      }

      if (event === "SIGNED_OUT") {
        console.log("User signed out");
      }

      if (event === "SIGNED_IN") {
        console.log("User signed in");
      }

      if (mounted) {
        setUser(session?.user ?? null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{ user, loading, refreshUser, signInWithOAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
