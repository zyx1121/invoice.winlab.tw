import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";
  const response = NextResponse.redirect(`${origin}${next}`);

  try {
    if (!code) return response;

    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          const opts = {
            domain:
              process.env.NODE_ENV === "production" ? ".winlab.tw" : undefined,
            sameSite: "lax" as const,
            secure: process.env.NODE_ENV === "production",
            path: "/",
          };
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              response.cookies.set(name, value, { ...options, ...opts });
            } catch (err) {
              console.error("[Auth callback] set cookie failed:", name, err);
            }
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[Auth callback] exchangeCodeForSession:", error);
      return NextResponse.redirect(`${origin}/?error=auth_error`);
    }

    return response;
  } catch (error) {
    console.error("[Auth callback]:", error);
    return NextResponse.redirect(`${origin}/?error=unknown`);
  }
}
