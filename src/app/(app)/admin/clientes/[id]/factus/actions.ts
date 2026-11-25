"use server";

import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";

// A diferencia de "Editar plan", acá sí basta la sesión normal del admin —
// integraciones_factus usa la política "solo admin" de siempre (es_admin()),
// no el bloqueo especial que tiene "suscripciones" desde el cobro
// automático con Wompi. No hace falta la llave de servicio para este lado
// del flujo — ver src/lib/supabase/admin.ts para el lado que sí la
// necesita (la pantalla donde el cliente activa).
export async function guardarIntegracionFactus(input: {
  empresaId: string;
  factusClientId: string;
  factusClientSecret: string;
  factusUsername: string;
  factusPassword: string;
  numberingRangeId: string;
  numberingRangeIdNotasCredito: string;
  certificadoFacturacion: string;
  responsableIva: boolean | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requerirAdmin();

  if (
    !input.factusClientId.trim() ||
    !input.factusClientSecret.trim() ||
    !input.factusUsername.trim() ||
    !input.factusPassword.trim()
  ) {
    return { ok: false, error: "Completa las cuatro credenciales de Factus." };
  }
  const numberingRangeId = Number(input.numberingRangeId);
  if (!Number.isFinite(numberingRangeId) || numberingRangeId <= 0) {
    return { ok: false, error: "El id del rango de numeración no es válido." };
  }
  // Opcional a propósito — ver el texto de ayuda en factus-cliente-form.tsx.
  let numberingRangeIdNotasCredito: number | null = null;
  if (input.numberingRangeIdNotasCredito.trim()) {
    numberingRangeIdNotasCredito = Number(input.numberingRangeIdNotasCredito);
    if (!Number.isFinite(numberingRangeIdNotasCredito) || numberingRangeIdNotasCredito <= 0) {
      return { ok: false, error: "El id del rango de numeración de notas crédito no es válido." };
    }
  }
  if (input.certificadoFacturacion !== "mensual" && input.certificadoFacturacion !== "anual") {
    return { ok: false, error: "Elige una frecuencia de facturación válida para el certificado." };
  }
  if (input.responsableIva === null) {
    return { ok: false, error: "Elige si esta empresa es responsable de IVA." };
  }

  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("integraciones_factus")
    .select("id")
    .eq("empresa_id", input.empresaId)
    .maybeSingle();

  const datos = {
    factus_client_id: input.factusClientId.trim(),
    factus_client_secret: input.factusClientSecret.trim(),
    factus_username: input.factusUsername.trim(),
    factus_password: input.factusPassword.trim(),
    numbering_range_id: numberingRangeId,
    numbering_range_id_notas_credito: numberingRangeIdNotasCredito,
    certificado_facturacion: input.certificadoFacturacion,
  };

  // No toca "estado" si ya existía la fila — corregir credenciales de un
  // cliente ya activo no debe devolverlo a 'pendiente' ni pedirle que
  // vuelva a aceptar. Solo una fila nueva nace 'pendiente' (el default de
  // la tabla).
  const { error } = existente
    ? await supabase.from("integraciones_factus").update(datos).eq("id", existente.id)
    : await supabase.from("integraciones_factus").insert({ empresa_id: input.empresaId, ...datos });

  if (error) {
    return { ok: false, error: `No se pudo guardar: ${error.message}` };
  }

  // responsable_iva vive en empresas, no en integraciones_factus — es un
  // dato del régimen tributario de la empresa, no de la cuenta de Factus
  // en sí (mismo criterio que arl_clase_riesgo/exonerado_ley_1607 en
  // Nómina). Un trigger en schema.sql (proteger_responsable_iva()) exige
  // que quien escriba esto sea admin — esta función ya lo es, por
  // requerirAdmin() arriba, así que la sesión normal del admin basta.
  const { error: errorEmpresa } = await supabase
    .from("empresas")
    .update({ responsable_iva: input.responsableIva })
    .eq("id", input.empresaId);

  if (errorEmpresa) {
    return {
      ok: false,
      error: `Se guardaron las credenciales de Factus, pero no se pudo guardar si es responsable de IVA: ${errorEmpresa.message}`,
    };
  }

  return { ok: true };
}
