import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Las rutas /api/* quedan fuera a propósito: no son páginas de navegador,
  // así que no tiene sentido redirigirlas a /login sin sesión — cada una
  // valida su propio acceso (ej. el cron de cobro revisa su propio
  // CRON_SECRET en src/app/api/cron/cobro-suscripciones/route.ts).
  // .html también queda fuera: son archivos estáticos servidos tal cual
  // desde /public (ej. la presentación comercial), no páginas de la app.
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html)$).*)",
  ],
};
