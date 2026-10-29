"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { crearTokenBancolombia } from "@/lib/wompi";

// A diferencia de otros flujos de este proyecto (Google Calendar, correos),
// acá NO se usa NEXT_PUBLIC_APP_URL: esa variable tiene un único valor
// compartido entre Production y Preview (confirmado 2026-10-29, probando
// en Preview), y las URLs de Preview de Vercel cambian con cada push — un
// valor fijo nunca sería correcto para los dos casos a la vez. En cambio,
// se arma la URL real desde los headers de la propia petición entrante
// (los que pone Vercel según el dominio que de verdad se está usando en
// ese momento), para que el cliente siempre vuelva al mismo sitio desde el
// que arrancó, sea Preview o producción.
async function origenActual(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if (!host) throw new Error("No se pudo determinar la URL de la aplicación.");
  const proto = headerStore.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

// Arranca la conexión con Bancolombia: pide el token de autorización a
// Wompi y manda al cliente a autorizar su cuenta en el sitio real de
// Bancolombia (nunca acá dentro de Datum). El id del token queda en una
// cookie de corta duración (httpOnly, 15 minutos) para que
// /api/wompi/bancolombia-callback sepa cuál revisar cuando el cliente
// vuelva — no se guarda en ninguna tabla todavía, porque hasta que
// Bancolombia confirme la autorización esto ni siquiera es un método de
// pago real.
export async function conectarBancolombia(): Promise<
  { ok: true; authorizationUrl: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu sesión expiró. Inicia sesión de nuevo." };

  try {
    const urlBase = await origenActual();

    const { id, authorizationUrl } = await crearTokenBancolombia(
      `${urlBase}/api/wompi/bancolombia-callback`,
    );

    const cookieStore = await cookies();
    cookieStore.set("wompi_bancolombia_token", id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 900,
      path: "/",
    });

    return { ok: true, authorizationUrl };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo conectar con Bancolombia.",
    };
  }
}
