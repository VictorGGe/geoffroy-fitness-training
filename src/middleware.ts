import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_CONFIG_OK, SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";

/** Routes accessibles sans être connecté. Tout le reste est privé. */
const PUBLIC_PATHS = ["/login", "/forgot-password", "/auth/callback", "/reset-password", "/diagnostic", "/cross-training", "/api/ct/public"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  const toDiagnostic = () => {
    if (path === "/diagnostic") return response;
    const url = request.nextUrl.clone();
    url.pathname = "/diagnostic";
    url.search = "";
    return NextResponse.redirect(url);
  };

  // Configuration absente ou invalide : page de diagnostic au lieu d'une erreur 500.
  if (!SUPABASE_CONFIG_OK) return toDiagnostic();

  let supabase;
  try {
    supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  } catch {
    return toDiagnostic();
  }

  // Vérifie l'utilisateur auprès du serveur d'authentification (ne pas se fier au seul cookie).
  let user = null;
  try {
    user = (await supabase.auth.getUser()).data.user;
  } catch {
    user = null;
  }
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
  const isClientUser = user?.app_metadata?.role === "client";
  const inClientSpace = path === "/espace" || path.startsWith("/espace/");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path !== "/" ? `?next=${encodeURIComponent(path + request.nextUrl.search)}` : "";
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = isClientUser ? "/espace" : "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Un client n'accède qu'à son espace ; le coach n'a pas besoin de l'espace client.
  if (user && !isPublic && !path.startsWith("/auth/")) {
    if (isClientUser && !inClientSpace) {
      const url = request.nextUrl.clone();
      url.pathname = "/espace";
      url.search = "";
      return NextResponse.redirect(url);
    }
    if (!isClientUser && inClientSpace) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
