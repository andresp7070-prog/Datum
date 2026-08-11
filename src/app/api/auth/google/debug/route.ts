import { NextResponse } from "next/server";
import { urlBaseApp, urlRedirectGoogle } from "@/lib/google";

// Ruta temporal de diagnóstico para el error "Missing required parameter:
// client_id" al conectar Google Calendar — confirma si las variables de
// entorno realmente le están llegando a la función en producción, sin
// exponer ningún valor sensible (solo booleanos y la URL pública). Borrar
// una vez resuelto.
export async function GET() {
  return NextResponse.json({
    tieneClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
    tieneClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    appUrl: urlBaseApp(),
    redirectUriQueDebeEstarEnGoogle: urlRedirectGoogle(),
  });
}
