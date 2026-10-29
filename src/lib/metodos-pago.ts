import { createAdminClient } from "@/lib/supabase/admin";

// Guarda un método de pago nuevo (tarjeta o Bancolombia, y más adelante
// Nequi) y lo deja como predeterminado — usado tanto por el flujo de
// tarjeta (/api/wompi/guardar-metodo-pago) como por el de Bancolombia
// (/api/wompi/bancolombia-callback), para que el criterio de "la primera
// tarjeta/cuenta fija fecha_proximo_cobro, las siguientes no" sea
// EXACTAMENTE el mismo sin importar el método — antes esta lógica vivía
// duplicada dentro de guardar-metodo-pago/route.ts. Usa la llave de
// servicio por el mismo motivo ya documentado en src/lib/supabase/admin.ts
// (punto 4): crear un método de pago exige haberlo tokenizado con Wompi
// primero, y desde que se cerró el permiso de edición normal sobre
// suscripciones, la sesión del cliente tampoco puede escribir acá.
export async function guardarMetodoPago(input: {
  empresaId: string;
  wompiFuentePagoId: string;
  tipo: "tarjeta" | "bancolombia" | "nequi";
  marca: string | null;
  ultimosDigitos: string | null;
  titular: string | null;
}): Promise<void> {
  const admin = createAdminClient();

  const { count: metodosExistentes } = await admin
    .from("metodos_pago")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", input.empresaId);
  const esLaPrimera = !metodosExistentes;

  // Toda tarjeta/cuenta nueva se guarda como la predeterminada — es la más
  // reciente, lo más probable es que sea la que se quiere usar ya. Si ya
  // había otras, se apagan primero para que nunca quede ninguna o dos
  // marcadas a la vez (mismo criterio que
  // marcar_metodo_pago_predeterminado() en schema.sql).
  if (!esLaPrimera) {
    await admin
      .from("metodos_pago")
      .update({ es_predeterminado: false })
      .eq("empresa_id", input.empresaId);
  }

  const { error: errorMetodo } = await admin.from("metodos_pago").insert({
    empresa_id: input.empresaId,
    wompi_fuente_pago_id: input.wompiFuentePagoId,
    tipo: input.tipo,
    metodo_marca: input.marca,
    metodo_ultimos_digitos: input.ultimosDigitos,
    titular: input.titular,
    es_predeterminado: true,
  });
  if (errorMetodo) throw new Error(errorMetodo.message);

  // El primer cobro debe caer cuando de verdad termina la prueba gratuita,
  // no apenas se guarda el método (alguien podría agregarlo antes de que
  // se le venza) — y si ya se venció (este fue el gate forzado), toca
  // cobrar lo antes posible, así que el cron lo recoge en su próxima
  // corrida. Pero eso solo aplica al PRIMER método que se guarda — si ya
  // tenía otro (esto es agregar uno adicional desde "Mis métodos de
  // pago"), se deja fecha_proximo_cobro tal como estaba, para no reiniciar
  // un ciclo de cobro que ya estaba en curso.
  if (esLaPrimera) {
    const { data: suscripcionActual } = await admin
      .from("suscripciones")
      .select("id, fecha_fin_prueba")
      .eq("empresa_id", input.empresaId)
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
      .eq("empresa_id", input.empresaId);
    if (error) throw new Error(error.message);
  }
}
