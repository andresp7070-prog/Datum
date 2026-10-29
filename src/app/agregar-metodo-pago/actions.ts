"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { crearTokenBancolombia } from "@/lib/wompi";

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
    const urlBase = process.env.NEXT_PUBLIC_APP_URL;
    if (!urlBase) throw new Error("Falta configurar NEXT_PUBLIC_APP_URL.");

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
