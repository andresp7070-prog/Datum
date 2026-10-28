"use server";

import { requerirAdmin } from "@/lib/empresa";
import { createAdminClient } from "@/lib/supabase/admin";

const PLANES_VALIDOS = ["basic", "startup", "pyme", "enterprise"] as const;

// Cambia el plan/módulos/monto de un cliente que ya existe — la contraparte
// de crearCliente() (que es solo para la creación inicial). Usa la llave de
// servicio por el mismo motivo que guardar-metodo-pago/route.ts: desde que
// se cerró el permiso de edición sobre "suscripciones" (ver schema.sql,
// sección "COBRO AUTOMÁTICO CON WOMPI"), ninguna sesión normal — ni siquiera
// la de Andrés como admin — puede escribir ahí, solo leerla. Sexto uso
// legítimo de esa llave en el proyecto (ver src/lib/supabase/admin.ts).
export async function actualizarPlanCliente(input: {
  empresaId: string;
  modulosActivos: string[];
  plan: string;
  montoMensual: string;
  facturacion: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requerirAdmin();

  if (input.modulosActivos.length === 0) {
    return { ok: false, error: "Elige al menos un módulo." };
  }
  if (!PLANES_VALIDOS.includes(input.plan as (typeof PLANES_VALIDOS)[number])) {
    return { ok: false, error: "Elige un plan válido." };
  }
  const montoMensual = Number(input.montoMensual);
  if (!Number.isFinite(montoMensual) || montoMensual <= 0) {
    return { ok: false, error: "El monto mensual no es válido." };
  }
  if (input.facturacion !== "mensual" && input.facturacion !== "anual") {
    return { ok: false, error: "Elige una frecuencia de facturación válida." };
  }

  const supabase = createAdminClient();

  // Panel de control (insights) siempre va incluido y gratis, sin ocupar
  // cupo del plan — igual que en crearCliente(), no se pide en el
  // formulario, se agrega acá.
  const modulosActivos = [...new Set([...input.modulosActivos, "insights"])];

  const { error: errorEmpresa } = await supabase
    .from("empresas")
    .update({ modulos_activos: modulosActivos, monto_mensual: montoMensual })
    .eq("id", input.empresaId);
  if (errorEmpresa) {
    return { ok: false, error: `No se pudo actualizar la empresa: ${errorEmpresa.message}` };
  }

  const { data: suscripcionActual } = await supabase
    .from("suscripciones")
    .select("id")
    .eq("empresa_id", input.empresaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const datosSuscripcion = {
    plan: input.plan,
    monto_mensual: montoMensual,
    facturacion: input.facturacion,
  };

  // No toca fecha_proximo_cobro en ningún caso — el monto nuevo aplica
  // desde el próximo cobro ya programado, nunca de inmediato (sin
  // prorrateo, por ahora — ver CLAUDE.md, sección "Cobros").
  const { error: errorSuscripcion } = suscripcionActual
    ? await supabase.from("suscripciones").update(datosSuscripcion).eq("id", suscripcionActual.id)
    : await supabase.from("suscripciones").insert({ empresa_id: input.empresaId, ...datosSuscripcion });

  if (errorSuscripcion) {
    return { ok: false, error: `No se pudo actualizar la suscripción: ${errorSuscripcion.message}` };
  }

  return { ok: true };
}
