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
  // Confirmado 2026-10-28 probando en sandbox (se revisó el POST real que
  // manda el widget, vía un HAR exportado del navegador): el campo se
  // llama payment_source_token, no "token" como se había adivinado al
  // principio — por eso el guardado fallaba siempre con "No se pudo leer
  // la tarjeta", incluso con una tarjeta de prueba válida y ya tokenizada
  // correctamente del lado de Wompi.
  const tokenTarjeta = formData.get("payment_source_token") as string | null;
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

    // Escribe con la llave de servicio a propósito: crear un método de
    // pago exige haberlo tokenizado con Wompi primero, y desde que se
    // cerró el permiso de edición normal sobre suscripciones (ver
    // schema.sql, sección "COBRO AUTOMÁTICO CON WOMPI") esa misma lógica
    // aplica a metodos_pago — solo la llave de servicio puede insertar
    // ahí. Sexto uso legítimo de esta llave en el proyecto (ver
    // src/lib/supabase/admin.ts).
    const admin = createAdminClient();

    const { count: metodosExistentes } = await admin
      .from("metodos_pago")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", perfil.empresa_id);

    const esLaPrimera = !metodosExistentes;

    // Toda tarjeta nueva se guarda como la predeterminada — es la más
    // reciente, lo más probable es que sea la que se quiere usar ya. Si
    // ya había otras, se apagan primero para que nunca quede ninguna o
    // dos marcadas a la vez (mismo criterio que
    // marcar_metodo_pago_predeterminado() en schema.sql).
    if (!esLaPrimera) {
      await admin
        .from("metodos_pago")
        .update({ es_predeterminado: false })
        .eq("empresa_id", perfil.empresa_id);
    }

    const { error: errorMetodo } = await admin.from("metodos_pago").insert({
      empresa_id: perfil.empresa_id,
      wompi_fuente_pago_id: String(fuentePago.id),
      tarjeta_marca: fuentePago.marca,
      tarjeta_ultimos_digitos: fuentePago.ultimosDigitos,
      es_predeterminado: true,
    });
    if (errorMetodo) throw new Error(errorMetodo.message);

    // El primer cobro debe caer cuando de verdad termina la prueba
    // gratuita, no apenas se guarda la tarjeta (alguien podría agregarla
    // antes de que se le venza) — y si ya se venció (este fue el gate
    // forzado), toca cobrar lo antes posible, así que el cron lo recoge en
    // su próxima corrida. Pero eso solo aplica la PRIMERA tarjeta que se
    // guarda — si ya tenía otra (esto es agregar una adicional desde
    // "Mis métodos de pago"), se deja fecha_proximo_cobro tal como
    // estaba, para no reiniciar un ciclo de cobro que ya estaba en curso.
    if (esLaPrimera) {
      const { data: suscripcionActual } = await admin
        .from("suscripciones")
        .select("id, fecha_fin_prueba")
        .eq("empresa_id", perfil.empresa_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const ahora = new Date();
      const fechaFinPrueba = suscripcionActual?.fecha_fin_prueba
        ? new Date(suscripcionActual.fecha_fin_prueba)
        : ahora;
      const fechaProximoCobro = fechaFinPrueba > ahora ? fechaFinPrueba : ahora;

      const { error } = await admin
        .from("suscripciones")
        .update({ fecha_proximo_cobro: fechaProximoCobro.toISOString() })
        .eq("empresa_id", perfil.empresa_id);
      if (error) throw new Error(error.message);
    }
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "No se pudo guardar el método de pago.";
    return NextResponse.redirect(
      `${urlBase}/agregar-metodo-pago?error=${encodeURIComponent(mensaje)}`,
    );
  }

  return NextResponse.redirect(`${urlBase}/metodos-pago`);
}
