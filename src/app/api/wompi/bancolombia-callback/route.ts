import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  consultarTokenBancolombia,
  crearFuentePagoWompi,
  obtenerTokensAceptacionWompi,
} from "@/lib/wompi";
import { guardarMetodoPago } from "@/lib/metodos-pago";

// A donde Wompi/Bancolombia redirige el navegador del cliente después de
// que autoriza (o cancela) su cuenta — ver crearTokenBancolombia() y
// conectarBancolombia(). El id del token pendiente viaja en una cookie de
// corta duración puesta justo antes de mandar al cliente a Bancolombia,
// nunca en la URL — así no queda expuesto en el historial del navegador
// ni en logs.
export async function GET(request: Request) {
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

  const cookieStore = await cookies();
  const tokenId = cookieStore.get("wompi_bancolombia_token")?.value;
  cookieStore.delete("wompi_bancolombia_token");

  if (!tokenId) {
    return NextResponse.redirect(
      `${urlBase}/agregar-metodo-pago?error=${encodeURIComponent(
        "No se pudo completar la conexión con Bancolombia. Intenta de nuevo.",
      )}`,
    );
  }

  try {
    const estado = await consultarTokenBancolombia(tokenId);
    if (estado.estado !== "APPROVED") {
      throw new Error(
        "No autorizaste tu cuenta de Bancolombia, o la autorización fue rechazada. Intenta de nuevo.",
      );
    }

    const tokens = await obtenerTokensAceptacionWompi();
    const fuentePago = await crearFuentePagoWompi({
      tipo: "BANCOLOMBIA_TRANSFER",
      token: tokenId,
      correoCliente: user.email ?? "",
      acceptanceToken: tokens.acceptanceToken,
      acceptPersonalAuth: tokens.acceptPersonalAuth,
      descripcionPago: "Suscripción Datum",
    });

    await guardarMetodoPago({
      empresaId: perfil.empresa_id,
      wompiFuentePagoId: String(fuentePago.id),
      tipo: "bancolombia",
      marca: fuentePago.marca,
      ultimosDigitos: fuentePago.ultimosDigitos,
    });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "No se pudo conectar con Bancolombia.";
    return NextResponse.redirect(
      `${urlBase}/agregar-metodo-pago?error=${encodeURIComponent(mensaje)}`,
    );
  }

  return NextResponse.redirect(`${urlBase}/metodos-pago`);
}
