import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { crearCobroRecurrenteWompi } from "@/lib/wompi";

// Mismo 15% que DESCUENTO_ANUAL en src/app/landing.tsx y en
// src/app/(app)/admin/clientes/nuevo/nuevo-cliente-form.tsx — si ese
// porcentaje cambia ahí, hay que cambiarlo acá también.
const DESCUENTO_ANUAL = 0.15;

// Dispara el cobro automático de cada suscripción que ya le toca pagar
// (ver CLAUDE.md, sección "Cobros"). Mismo patrón que el cron del resumen
// semanal: Vercel lo llama solo, sin ninguna persona con sesión iniciada.
// Solo CREA el cobro en Wompi y deja la fila en 'pendiente' — el
// resultado final (aprobado/declinado) llega después por el webhook
// (src/app/api/webhooks/wompi/route.ts), nunca acá.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const ahora = new Date();

  // Candidatas: no están canceladas, y ya les toca cobrar (fecha_proximo_cobro
  // quedó en el pasado o es justo ahora). Ya no se filtra acá por tener
  // tarjeta guardada — eso se revisa abajo, una por una, contra
  // metodos_pago (una empresa puede tener varias, se usa la marcada como
  // predeterminada). Una suscripción 'vencida' (el cobro anterior falló)
  // también se reintenta acá — todavía no hay una cola de reintentos
  // aparte ni un tope de cuántas veces se reintenta.
  const { data: suscripciones, error } = await supabase
    .from("suscripciones")
    .select("id, empresa_id, monto_mensual, facturacion")
    .not("fecha_proximo_cobro", "is", null)
    .neq("estado", "cancelada")
    .lte("fecha_proximo_cobro", ahora.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let cobrados = 0;
  const errores: string[] = [];

  for (const suscripcion of suscripciones ?? []) {
    try {
      const { data: metodoPago } = await supabase
        .from("metodos_pago")
        .select("wompi_fuente_pago_id, tipo")
        .eq("empresa_id", suscripcion.empresa_id)
        .eq("es_predeterminado", true)
        .maybeSingle();
      if (!metodoPago) {
        throw new Error("No tiene ningún método de pago marcado como predeterminado");
      }

      const { data: perfilAdmin } = await supabase
        .from("perfiles")
        .select("id")
        .eq("empresa_id", suscripcion.empresa_id)
        .eq("rol_empresa", "administrador")
        .limit(1)
        .maybeSingle();
      if (!perfilAdmin) throw new Error("No se encontró un administrador para esta empresa");

      const { data: usuario } = await supabase.auth.admin.getUserById(perfilAdmin.id);
      const correoCliente = usuario.user?.email;
      if (!correoCliente) throw new Error("No se encontró el correo del cliente");

      // Mensual: se cobra monto_mensual cada vez. Anual: una sola vez al
      // año, el total con el descuento ya aplicado — no el monto mensual
      // cobrado doce veces.
      const montoACobrar =
        suscripcion.facturacion === "anual"
          ? Number(suscripcion.monto_mensual) * 12 * (1 - DESCUENTO_ANUAL)
          : Number(suscripcion.monto_mensual);

      // Incluye el timestamp para que nunca choque con una referencia
      // anterior de la misma suscripción, como recomienda Wompi.
      const referencia = `datum-${suscripcion.id}-${Date.now()}`;

      const transaccion = await crearCobroRecurrenteWompi({
        fuentePagoId: Number(metodoPago.wompi_fuente_pago_id),
        montoEnCentavos: Math.round(montoACobrar * 100),
        correoCliente,
        referencia,
        tipo: metodoPago.tipo as "tarjeta" | "bancolombia",
        descripcionPago: "Suscripción Datum",
      });

      const { error: errorInsert } = await supabase.from("suscripcion_cobros").insert({
        suscripcion_id: suscripcion.id,
        wompi_transaccion_id: transaccion.id,
        monto: montoACobrar,
        estado: "pendiente",
      });
      // Si esto falla, el cobro en Wompi YA se creó pero queda sin rastro
      // acá — el webhook que llegue después no va a encontrar ninguna
      // fila que actualizar. Caso raro (requiere que Wompi responda bien
      // y esta escritura falle), pero queda en los errores para revisar
      // a mano si pasa.
      if (errorInsert) {
        throw new Error(
          `Wompi creó la transacción ${transaccion.id} pero no se pudo guardar acá: ${errorInsert.message}`,
        );
      }

      cobrados++;
    } catch (err) {
      errores.push(
        `Suscripción ${suscripcion.id}: ${err instanceof Error ? err.message : "error desconocido"}`,
      );
    }
  }

  return NextResponse.json({ cobrados, errores });
}
