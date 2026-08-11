"use server";

import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";

export async function crearMovimiento(input: {
  tipo: "ingreso" | "gasto";
  categoria: string;
  monto: number;
  fecha: string;
  nota: string;
  recurrente: boolean;
  frecuencia: string;
}): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("datum_movimientos").insert({
    tipo: input.tipo,
    categoria: input.categoria || null,
    monto: input.monto,
    fecha: input.fecha,
    nota: input.nota || null,
    recurrente: input.recurrente,
    frecuencia: input.frecuencia || null,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function borrarMovimiento(movimientoId: string): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();

  // pasivo_id is null: no se puede borrar el gasto que generó solo un abono
  // de deuda — eso se corrige desde Deudas.
  const { error } = await supabase
    .from("datum_movimientos")
    .delete()
    .eq("id", movimientoId)
    .is("pasivo_id", null);

  if (error) return { error: error.message };
  return { error: null };
}

export async function actualizarMovimiento(input: {
  movimientoId: string;
  tipo: "ingreso" | "gasto";
  categoria: string;
  monto: number;
  fecha: string;
  nota: string;
  recurrente: boolean;
  frecuencia: string;
}): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("datum_movimientos")
    // pasivo_id is null protege los movimientos generados automáticamente
    // por un abono de deuda — esos se corrigen desde Deudas.
    .update({
      tipo: input.tipo,
      categoria: input.categoria || null,
      monto: input.monto,
      fecha: input.fecha,
      nota: input.nota || null,
      recurrente: input.recurrente,
      frecuencia: input.frecuencia || null,
    })
    .eq("id", input.movimientoId)
    .is("pasivo_id", null);

  if (error) return { error: error.message };
  return { error: null };
}

export async function crearPasivo(input: {
  descripcion: string;
  tipo: string;
  montoTotal: number;
  fechaVencimiento: string;
  frecuenciaPago: string;
}): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("datum_pasivos").insert({
    descripcion: input.descripcion,
    tipo: input.tipo || null,
    monto_total: input.montoTotal,
    fecha_vencimiento: input.fechaVencimiento || null,
    frecuencia_pago: input.frecuenciaPago || null,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function actualizarPasivo(input: {
  pasivoId: string;
  descripcion: string;
  tipo: string;
  montoTotal: number;
  fechaVencimiento: string;
  frecuenciaPago: string;
}): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();

  const { data: pasivo, error: errorLectura } = await supabase
    .from("datum_pasivos")
    .select("monto_pagado")
    .eq("id", input.pasivoId)
    .single();

  if (errorLectura || !pasivo) {
    return { error: errorLectura?.message ?? "No se encontró la deuda." };
  }

  if (input.montoTotal < pasivo.monto_pagado) {
    return {
      error: `El monto total no puede quedar por debajo de lo que ya se ha pagado (${pasivo.monto_pagado.toLocaleString("es-CO", { style: "currency", currency: "COP" })}).`,
    };
  }

  const { error } = await supabase
    .from("datum_pasivos")
    .update({
      descripcion: input.descripcion,
      tipo: input.tipo || null,
      monto_total: input.montoTotal,
      fecha_vencimiento: input.fechaVencimiento || null,
      frecuencia_pago: input.frecuenciaPago || null,
      // Si el monto total baja hasta igualar lo ya pagado, queda pagada sola;
      // si sube por encima de lo pagado, vuelve a quedar pendiente.
      estado: pasivo.monto_pagado >= input.montoTotal ? "pagado" : "pendiente",
    })
    .eq("id", input.pasivoId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function registrarAbono(input: {
  pasivoId: string;
  monto: number;
  fecha: string;
}): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();

  const { data: pasivo, error: errorLectura } = await supabase
    .from("datum_pasivos")
    .select("descripcion, monto_total, monto_pagado")
    .eq("id", input.pasivoId)
    .single();

  if (errorLectura || !pasivo) {
    return { error: errorLectura?.message ?? "No se encontró la deuda." };
  }

  const saldoRestante = pasivo.monto_total - pasivo.monto_pagado;
  const montoAplicado = Math.min(input.monto, saldoRestante);
  const nuevoPagado = pasivo.monto_pagado + montoAplicado;
  const nuevoEstado = nuevoPagado >= pasivo.monto_total ? "pagado" : "pendiente";

  const { error } = await supabase
    .from("datum_pasivos")
    .update({ monto_pagado: nuevoPagado, estado: nuevoEstado })
    .eq("id", input.pasivoId);

  if (error) return { error: error.message };

  const { error: errorGasto } = await supabase.from("datum_movimientos").insert({
    tipo: "gasto",
    categoria: "pago de deuda",
    monto: montoAplicado,
    fecha: input.fecha,
    nota: `Abono a "${pasivo.descripcion}"`,
    pasivo_id: input.pasivoId,
  });

  if (errorGasto) return { error: errorGasto.message };
  return { error: null };
}

export async function marcarPagado(input: {
  pasivoId: string;
  fecha: string;
}): Promise<{ error: string | null }> {
  await requerirAdmin();
  const supabase = await createClient();

  const { data: pasivo, error: errorLectura } = await supabase
    .from("datum_pasivos")
    .select("descripcion, monto_total, monto_pagado")
    .eq("id", input.pasivoId)
    .single();

  if (errorLectura || !pasivo) {
    return { error: errorLectura?.message ?? "No se encontró la deuda." };
  }

  const saldoRestante = pasivo.monto_total - pasivo.monto_pagado;

  const { error } = await supabase
    .from("datum_pasivos")
    .update({ monto_pagado: pasivo.monto_total, estado: "pagado" })
    .eq("id", input.pasivoId);

  if (error) return { error: error.message };

  if (saldoRestante > 0) {
    const { error: errorGasto } = await supabase.from("datum_movimientos").insert({
      tipo: "gasto",
      categoria: "pago de deuda",
      monto: saldoRestante,
      fecha: input.fecha,
      nota: `Pago final de "${pasivo.descripcion}"`,
      pasivo_id: input.pasivoId,
    });

    if (errorGasto) return { error: errorGasto.message };
  }

  return { error: null };
}
