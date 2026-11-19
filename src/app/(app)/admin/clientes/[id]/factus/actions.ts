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
  certificadoFacturacion: string;
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
  if (input.certificadoFacturacion !== "mensual" && input.certificadoFacturacion !== "anual") {
    return { ok: false, error: "Elige una frecuencia de facturación válida para el certificado." };
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
  return { ok: true };
}
