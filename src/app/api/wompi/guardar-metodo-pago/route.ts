import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { crearFuentePagoWompi } from "@/lib/wompi";
import { guardarMetodoPago } from "@/lib/metodos-pago";

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
      tipo: "CARD",
      token: tokenTarjeta,
      correoCliente: user.email ?? "",
      acceptanceToken,
      acceptPersonalAuth,
      sessionId,
      deviceId,
    });

    await guardarMetodoPago({
      empresaId: perfil.empresa_id,
      wompiFuentePagoId: String(fuentePago.id),
      tipo: "tarjeta",
      marca: fuentePago.marca,
      ultimosDigitos: fuentePago.ultimosDigitos,
      titular: fuentePago.titular,
    });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "No se pudo guardar el método de pago.";
    return NextResponse.redirect(
      `${urlBase}/agregar-metodo-pago?error=${encodeURIComponent(mensaje)}`,
    );
  }

  return NextResponse.redirect(`${urlBase}/metodos-pago`);
}
