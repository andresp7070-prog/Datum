import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { intercambiarCodigoPorTokens, obtenerCorreoGoogle, urlBaseApp } from "@/lib/google";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stateCookie = request.cookies.get("google_oauth_state")?.value;
  const next = request.cookies.get("google_oauth_next")?.value || "/crm";

  const destino = new URL(next, urlBaseApp());
  const limpiarCookies = (respuesta: NextResponse) => {
    respuesta.cookies.delete("google_oauth_state");
    respuesta.cookies.delete("google_oauth_next");
    return respuesta;
  };

  if (!code || !state || !stateCookie || state !== stateCookie) {
    destino.searchParams.set("google_error", "1");
    return limpiarCookies(NextResponse.redirect(destino));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return limpiarCookies(NextResponse.redirect(new URL("/login", urlBaseApp())));

  try {
    const tokens = await intercambiarCodigoPorTokens(code);

    if (tokens.refresh_token) {
      const correo = await obtenerCorreoGoogle(tokens.access_token);
      const { error } = await supabase
        .from("integraciones_google")
        .upsert({ perfil_id: user.id, refresh_token: tokens.refresh_token, correo_google: correo });
      if (error) throw new Error(error.message);
    }
    // Si Google no mandó refresh_token es porque la persona ya había
    // autorizado la app antes y la conexión guardada sigue sirviendo — no
    // hay nada nuevo que guardar.

    destino.searchParams.set("google_conectado", "1");
    return limpiarCookies(NextResponse.redirect(destino));
  } catch {
    destino.searchParams.set("google_error", "1");
    return limpiarCookies(NextResponse.redirect(destino));
  }
}
