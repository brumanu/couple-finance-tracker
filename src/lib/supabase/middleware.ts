import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/manifest.webmanifest",
  "/icon",
  "/apple-icon",
];

// Se o JWT expira em menos que isso, fazemos o refresh (via getUser) na
// middleware pra evitar que o usuário seja deslogado no meio do uso.
const REFRESH_THRESHOLD_SECONDS = 5 * 60; // 5 minutos

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Verificação rápida via getClaims (JWT verificado localmente, JWKS
  // cacheado em memória — sem round-trip por request).
  let authed = false;
  let precisaRefresh = false;

  try {
    const { data, error } = await supabase.auth.getClaims();
    if (!error && data?.claims) {
      authed = true;
      const exp = data.claims.exp;
      if (typeof exp === "number") {
        const agora = Math.floor(Date.now() / 1000);
        precisaRefresh = exp - agora < REFRESH_THRESHOLD_SECONDS;
      }
    }
  } catch {
    // getClaims pode falhar (JWT ausente/inválido/expirado). Deixa o
    // fallback abaixo cuidar via getUser.
  }

  // Só faz o getUser (round-trip Supabase) se ainda não sabemos se está
  // autenticado ou se o JWT precisa refresh.
  if (!authed || precisaRefresh) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authed = Boolean(user);
  }

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!authed && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (authed && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
