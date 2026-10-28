import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { crearFuentePagoWompi } from "@/lib/wompi";

// Recibe el POST que el widget de tokenización de Wompi manda solo, una
// vez la persona terminó de escribir su tarjeta (ver
// src/app/agregar-metodo-pago/formulario-metodo-pago.tsx). No es un server
// action de Next.js porque el widget hace un form submit normal del
// navegador, no una llamada que Next sepa interpretar como acción.
export async function POST(request: Request) {
  const urlBase = new URL(request.url).origin;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${urlBase}/login`);

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();
  if (!perfil?.empresa_id) return NextResponse.redirect(`${urlBase}/`);

  const formData = await request.formData();
  // El nombre exacto de este campo lo pone el widget de Wompi al terminar
  // de tokenizar — no se pudo confirmar contra la documentación todavía
  // (ver CLAUDE.md, sección "Cobros"). Si Wompi lo manda con otro nombre,
  // este es el primer lugar a revisar al probar en sandbox.
  const tokenTarjeta = formData.get("token") as string | null;
  const acceptanceToken = formData.get("acceptance_token") as string;
  const acceptPersonalAuth = formData.get("accept_personal_auth") as string;
  const sessionId = (formData.get("session_id") as string) || undefined;
  const deviceId = (formData.get("device_id") as string) || undefined;

  if (!tokenTarjeta) {
    return NextResponse.redirect(
      `${urlBase}/agregar-metodo-pago?error=${encodeURIComponent(
        "No se pudo leer la tarjeta. Intenta de nuevo.",
      )}`,
    );
  }

  try {
    const fuentePago = await crearFuentePagoWompi({
      tokenTarjeta,
      correoCliente: user.email ?? "",
      acceptanceToken,
      acceptPersonalAuth,
      sessionId,
      deviceId,
    });

    // Escribe con la llave de servicio a propósito: desde que se cerró el
    // permiso de edición normal sobre suscripciones (ver schema.sql,
    // sección "COBRO AUTOMÁTICO CON WOMPI"), la sesión del propio cliente
    // ya no puede escribir esta fila — solo lectura. Es el cuarto uso
    // legítimo de esta llave en el proyecto (ver src/lib/supabase/admin.ts).
    const admin = createAdminClient();
    const { error } = await admin
      .from("suscripciones")
      .update({ wompi_fuente_pago_id: fuentePago.id, proveedor_pago: "wompi" })
      .eq("empresa_id", perfil.empresa_id);
    if (error) throw new Error(error.message);
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "No se pudo guardar el método de pago.";
    return NextResponse.redirect(
      `${urlBase}/agregar-metodo-pago?error=${encodeURIComponent(mensaje)}`,
    );
  }

  return NextResponse.redirect(`${urlBase}/`);
}
