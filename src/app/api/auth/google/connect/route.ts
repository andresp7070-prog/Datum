import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { urlAutorizacionGoogle, urlBaseApp } from "@/lib/google";

// Arranca el "Conectar Google Calendar": guarda un token anti-CSRF y a
// dónde volver después (?next=/crm/abc123) en cookies de corta duración,
// y manda a la persona a la pantalla de autorización de Google.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", urlBaseApp()));

  const next = request.nextUrl.searchParams.get("next") ?? "/crm";
  const state = randomBytes(16).toString("hex");

  const response = NextResponse.redirect(urlAutorizacionGoogle(state));
  const opcionesCookie = { httpOnly: true, secure: true, sameSite: "lax" as const, maxAge: 600, path: "/" };
  response.cookies.set("google_oauth_state", state, opcionesCookie);
  response.cookies.set("google_oauth_next", next, opcionesCookie);
  return response;
}
