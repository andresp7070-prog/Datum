import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcularComisionWompi, verificarFirmaEventoWompi } from "@/lib/wompi";

type TransaccionWompi = {
  id: string;
  status: "PENDING" | "APPROVED" | "DECLINED" | "VOIDED" | "ERROR";
  status_message?: string | null;
  reference: string;
  amount_in_cents: number;
};

type EventoWompi = {
  event: string;
  data: { transaction?: TransaccionWompi };
  environment: "test" | "prod";
  signature: { properties: string[]; checksum: string };
  timestamp: number;
};

const ESTADO_WOMPI_A_COBRO: Record<string, "pendiente" | "aprobado" | "declinado" | "error" | "voided"> = {
  PENDING: "pendiente",
  APPROVED: "aprobado",
  DECLINED: "declinado",
  ERROR: "error",
  VOIDED: "voided",
};

// Recibe los avisos de Wompi cuando el estado de un cobro cambia (ver
// CLAUDE.md, sección "Cobros"). Nunca confía en el cuerpo sin verificar la
// firma primero — cualquiera podría mandar un POST falso diciendo "este
// cobro se aprobó". El cron que dispara cada cobro mensual (ver
// src/app/api/cron/cobro-suscripciones/route.ts) inserta la fila en
// suscripcion_cobros justo después de crear la transacción en Wompi (con
// el id que Wompi devuelve); este webhook solo la actualiza, nunca la
// crea.
export async function POST(request: Request) {
  const evento = (await request.json()) as EventoWompi;

  const firmaValida = await verificarFirmaEventoWompi({
    data: evento.data,
    timestamp: evento.timestamp,
    signature: evento.signature,
  });
  if (!firmaValida) {
    // No se responde 200 a propósito: si la firma no es válida, Wompi
    // reintenta — y si de verdad era un intento de suplantación, tampoco
    // importa, nunca se procesa.
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  if (evento.event !== "transaction.updated" || !evento.data.transaction) {
    // Tipos de evento que todavía no usamos (ej. nequi_token.updated) —
    // se confirma sin hacer nada, para que Wompi no reintente de más.
    return NextResponse.json({ ok: true });
  }

  // No se filtra por evento.environment: Datum tiene una sola base de
  // datos (no hay un Supabase aparte para pruebas), así que un cobro de
  // Sandbox actualiza las mismas tablas que uno real — a propósito,
  // porque así es como se va a probar todo esto. No hay riesgo de mezclar
  // datos de un cliente real: un token/fuente de pago de Sandbox nunca
  // puede referirse a la fuente de pago real de un cliente, son universos
  // separados dentro de Wompi. Mientras se prueba, usar una suscripción
  // de prueba propia, no la de un cliente real.
  const transaccion = evento.data.transaction;
  const estadoCobro = ESTADO_WOMPI_A_COBRO[transaccion.status] ?? "error";
  const montoCobrado = transaccion.amount_in_cents / 100;
  const admin = createAdminClient();

  const { data: cobro } = await admin
    .from("suscripcion_cobros")
    .select("id, estado, suscripcion_id")
    .eq("wompi_transaccion_id", transaccion.id)
    .maybeSingle();

  // No debería pasar — el cron siempre inserta la fila antes de crear la
  // transacción — pero si llega un evento de algo que no reconocemos, no
  // hay nada que actualizar.
  if (!cobro) return NextResponse.json({ ok: true });

  // Idempotencia: Wompi puede reenviar el mismo evento hasta 3 veces en
  // 24 horas si no respondemos 200 a tiempo. Si ya procesamos este mismo
  // estado, no se repite el efecto (ej. duplicar el ingreso en Datum).
  if (cobro.estado === estadoCobro) return NextResponse.json({ ok: true });

  // La comisión solo tiene sentido sobre un cobro que de verdad se aprobó
  // — en cualquier otro estado no hubo comisión (ver calcularComisionWompi
  // en src/lib/wompi.ts).
  const { comision, neto } =
    estadoCobro === "aprobado"
      ? calcularComisionWompi(montoCobrado)
      : { comision: null, neto: null };

  await admin
    .from("suscripcion_cobros")
    .update({
      estado: estadoCobro,
      mensaje_error: transaccion.status_message ?? null,
      comision_wompi: comision,
      monto_neto: neto,
    })
    .eq("id", cobro.id);

  if (estadoCobro === "aprobado") {
    const { data: suscripcion } = await admin
      .from("suscripciones")
      .select("facturacion")
      .eq("id", cobro.suscripcion_id)
      .single();

    const proximoCobro = new Date();
    if (suscripcion?.facturacion === "anual") {
      proximoCobro.setFullYear(proximoCobro.getFullYear() + 1);
    } else {
      proximoCobro.setMonth(proximoCobro.getMonth() + 1);
    }

    await admin
      .from("suscripciones")
      .update({ estado: "activa", fecha_proximo_cobro: proximoCobro.toISOString() })
      .eq("id", cobro.suscripcion_id);

    // Requisito fijado en CLAUDE.md, sección "Cobros": cada cobro exitoso
    // se registra solo como ingreso en las finanzas internas de Datum,
    // sin que Andrés lo escriba a mano — mismo criterio de caja que ya
    // usa marcar_nomina_pagada() del lado de los gastos de un cliente.
    // Se registra el monto COMPLETO como ingreso (es lo que de verdad se
    // le facturó al cliente — importa para el umbral de IVA, ver
    // CLAUDE.md) y la comisión de Wompi aparte como gasto, en vez de
    // registrar solo el neto — así "Utilidad neta" en /admin/panel ya
    // queda correcta sin perder el dato del bruto facturado.
    const fechaHoy = new Date().toISOString().slice(0, 10);
    await admin.from("datum_movimientos").insert([
      {
        tipo: "ingreso",
        categoria: "suscripciones",
        monto: montoCobrado,
        fecha: fechaHoy,
        nota: `Cobro automático Wompi — referencia ${transaccion.reference}`,
      },
      {
        tipo: "gasto",
        categoria: "comisión Wompi",
        monto: comision,
        fecha: fechaHoy,
        nota: `Comisión Wompi sobre cobro — referencia ${transaccion.reference}`,
      },
    ]);
  } else if (estadoCobro === "declinado" || estadoCobro === "error") {
    await admin.from("suscripciones").update({ estado: "vencida" }).eq("id", cobro.suscripcion_id);
    // Pendiente a propósito (ver CLAUDE.md, "Pendientes"): avisar por
    // correo con enviarCorreoPagoFallido y decidir cuándo suspender el
    // acceso si el cobro sigue fallando varios días seguidos.
  }

  return NextResponse.json({ ok: true });
}
