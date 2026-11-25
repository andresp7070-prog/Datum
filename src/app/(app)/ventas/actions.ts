"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  crearNotaCreditoFactus,
  crearNotaDebitoFactus,
  construirItemsFactura,
  formatearErroresFactus,
} from "@/lib/factus";

// Catálogo de la DIAN para correction_concept_code de notas débito —
// distinto al de notas crédito, nunca intercambiables (confirmado
// contra la documentación real de Factus).
const CONCEPTOS_NOTA_DEBITO: Record<string, string> = {
  "1": "Intereses",
  "2": "Gastos por cobrar",
  "3": "Cambio del valor",
  "4": "Otros",
};

// Anula una factura electrónica ya validada, usando una nota crédito —
// ver CLAUDE.md, "Facturación electrónica — Factus". La factura original
// nunca se toca ni se borra; solo queda enlazada a esta nota crédito
// nueva. Si algo falla, no se revierte nada de la venta ni de la factura,
// mismo criterio que facturarVentaElectronicamente().
export async function anularFacturaConNotaCredito(
  ventaId: string,
): Promise<
  { ok: true; numero: string; linkPublico: string; linkQr: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No hay sesión activa." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return { ok: false, error: "Tu usuario no tiene una empresa asignada." };
  }

  const supabaseAdmin = createAdminClient();

  const [{ data: empresa }, { data: venta }, { data: itemsVenta }, { data: facturaValidada }] =
    await Promise.all([
      supabase.from("empresas").select("responsable_iva").eq("id", perfil.empresa_id).single(),
      supabase
        .from("ventas")
        .select("cliente_nombre, contacto_id")
        .eq("id", ventaId)
        .eq("empresa_id", perfil.empresa_id)
        .single(),
      supabase
        .from("ventas_items")
        .select("id, item_id, nombre_libre, cantidad, precio_unitario")
        .eq("venta_id", ventaId),
      supabaseAdmin
        .from("facturas_electronicas")
        .select("id, numero_factus")
        .eq("venta_id", ventaId)
        .eq("estado", "validada")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!empresa) return { ok: false, error: "No se encontró la empresa." };
  if (empresa.responsable_iva === null) {
    return {
      ok: false,
      error: "Esta empresa todavía no tiene configurado si es responsable de IVA.",
    };
  }
  if (!venta) return { ok: false, error: "No se encontró la venta." };
  if (!itemsVenta || itemsVenta.length === 0) {
    return { ok: false, error: "La venta no tiene productos." };
  }
  if (!facturaValidada?.numero_factus) {
    return { ok: false, error: "Esta venta no tiene una factura electrónica validada para anular." };
  }

  // Evita anularla dos veces si el botón se presiona más de una vez.
  const { data: notaExistente } = await supabaseAdmin
    .from("notas_credito_electronicas")
    .select("id")
    .eq("factura_electronica_id", facturaValidada.id)
    .eq("estado", "validada")
    .maybeSingle();
  if (notaExistente) {
    return { ok: false, error: "Esta factura ya fue anulada con una nota crédito." };
  }

  const idsCatalogo = itemsVenta
    .map((item) => item.item_id)
    .filter((id): id is string => Boolean(id));
  const { data: catalogo } =
    idsCatalogo.length > 0
      ? await supabase.from("inventario_items").select("id, nombre").in("id", idsCatalogo)
      : { data: [] as { id: string; nombre: string }[] };
  const nombrePorItem = new Map((catalogo ?? []).map((c) => [c.id, c.nombre]));

  const { data: integracion } = await supabaseAdmin
    .from("integraciones_factus")
    .select(
      "estado, numbering_range_id_notas_credito, factus_client_id, factus_client_secret, factus_username, factus_password",
    )
    .eq("empresa_id", perfil.empresa_id)
    .maybeSingle();

  if (
    !integracion ||
    integracion.estado !== "activa" ||
    !integracion.numbering_range_id_notas_credito ||
    !integracion.factus_client_id ||
    !integracion.factus_client_secret ||
    !integracion.factus_username ||
    !integracion.factus_password
  ) {
    return {
      ok: false,
      error:
        "Falta configurar el rango de numeración de notas crédito de esta empresa — contáctanos.",
    };
  }

  // El documento del cliente (cédula/NIT) se lee de donde ya quedó
  // guardado al facturar la venta original (crm_contactos.atributos) —
  // nunca se vuelve a pedir, esta acción no tiene formulario.
  let tipoDocumento = "13";
  let numeroDocumento = "";
  if (venta.contacto_id) {
    const { data: contacto } = await supabase
      .from("crm_contactos")
      .select("atributos")
      .eq("id", venta.contacto_id)
      .single();
    const atributos = (contacto?.atributos ?? {}) as Record<string, unknown>;
    if (typeof atributos.tipo_documento === "string") tipoDocumento = atributos.tipo_documento;
    if (typeof atributos.numero_documento === "string") numeroDocumento = atributos.numero_documento;
  }
  if (!numeroDocumento) {
    return { ok: false, error: "No se encontró el documento del cliente de esta venta." };
  }

  const responsableIva = empresa.responsable_iva === true;
  const { items, monto } = construirItemsFactura(itemsVenta, nombrePorItem, responsableIva);

  // Fila 'pendiente' puesta ANTES de llamar a Factus, mismo criterio que
  // facturas_electronicas — si la función se cae a mitad de camino, queda
  // el registro de que se intentó.
  const { data: notaPendiente } = await supabaseAdmin
    .from("notas_credito_electronicas")
    .insert({ factura_electronica_id: facturaValidada.id, estado: "pendiente" })
    .select("id")
    .single();

  let resultado: Awaited<ReturnType<typeof crearNotaCreditoFactus>>;
  try {
    resultado = await crearNotaCreditoFactus(
      {
        clientId: integracion.factus_client_id,
        clientSecret: integracion.factus_client_secret,
        username: integracion.factus_username,
        password: integracion.factus_password,
      },
      {
        billNumber: facturaValidada.numero_factus,
        numberingRangeId: integracion.numbering_range_id_notas_credito,
        referenceCode: crypto.randomUUID(),
        correctionConceptCode: "2", // Anulación de factura electrónica
        paymentDetails: [{ paymentForm: "1", paymentMethodCode: "10", amount: monto }],
        customer: {
          identificationDocumentCode: tipoDocumento,
          identification: numeroDocumento,
          names: venta.cliente_nombre ?? "Consumidor final",
          responsibilities: ["R-99-PN"],
          legalOrganizationCode: tipoDocumento === "31" ? "1" : undefined,
          company: tipoDocumento === "31" ? venta.cliente_nombre ?? "Consumidor final" : undefined,
        },
        items,
      },
    );
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "No se pudo conectar con Factus.";
    if (notaPendiente) {
      await supabaseAdmin
        .from("notas_credito_electronicas")
        .update({ estado: "rechazada", mensaje_error: mensaje })
        .eq("id", notaPendiente.id);
    }
    return { ok: false, error: mensaje };
  }

  if (!resultado.exitosa) {
    const detalle = formatearErroresFactus(resultado.errores);
    if (notaPendiente) {
      await supabaseAdmin
        .from("notas_credito_electronicas")
        .update({ estado: "rechazada", mensaje_error: detalle })
        .eq("id", notaPendiente.id);
    }
    return { ok: false, error: `Factus rechazó la nota crédito: ${detalle}` };
  }

  if (notaPendiente) {
    await supabaseAdmin
      .from("notas_credito_electronicas")
      .update({
        estado: "validada",
        numero_factus: resultado.numero,
        cude: resultado.cude,
        link_publico: resultado.linkPublico,
        link_qr: resultado.linkQr,
      })
      .eq("id", notaPendiente.id);
  }

  // La nota crédito ya quedó validada ante la DIAN — eso ya no se puede
  // deshacer. Esto marca la venta como anulada en Datum (devuelve
  // inventario, y la saca de todos los reportes — ver anular_venta() en
  // schema.sql) para que lo que Datum muestra quede consistente con lo
  // que de verdad pasó. Sesión normal (no la llave de servicio): RLS en
  // "ventas" ya limita esto a la propia empresa, mismo criterio que
  // deshacer_venta().
  const { error: errorAnular } = await supabase.rpc("anular_venta", { p_venta_id: ventaId });
  if (errorAnular) {
    return {
      ok: false,
      error: `La nota crédito se generó correctamente ante la DIAN (número ${resultado.numero}), pero no se pudo marcar la venta como anulada en Datum: ${errorAnular.message}. Avísanos para corregirlo a mano.`,
    };
  }

  return {
    ok: true,
    numero: resultado.numero,
    linkPublico: resultado.linkPublico,
    linkQr: resultado.linkQr,
  };
}

// Agrega un cobro extra sobre una factura ya validada (ej. un interés por
// mora, un ajuste de precio) — lo contrario de anularFacturaConNotaCredito().
// A diferencia de esa, el monto no se recalcula de ventas_items — lo
// escribe quien agrega la nota, porque es un cargo nuevo que no estaba en
// la venta original, no una reversión de algo que ya existía.
export async function agregarNotaDebito(
  ventaId: string,
  input: { conceptoCode: string; descripcion: string; monto: number },
): Promise<
  { ok: true; numero: string; linkPublico: string; linkQr: string } | { ok: false; error: string }
> {
  if (!CONCEPTOS_NOTA_DEBITO[input.conceptoCode]) {
    return { ok: false, error: "Motivo no válido." };
  }
  if (!Number.isFinite(input.monto) || input.monto <= 0) {
    return { ok: false, error: "El monto debe ser mayor a cero." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No hay sesión activa." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return { ok: false, error: "Tu usuario no tiene una empresa asignada." };
  }

  const supabaseAdmin = createAdminClient();

  const [{ data: empresa }, { data: venta }, { data: facturaValidada }] = await Promise.all([
    supabase.from("empresas").select("responsable_iva").eq("id", perfil.empresa_id).single(),
    supabase
      .from("ventas")
      .select("cliente_nombre, contacto_id")
      .eq("id", ventaId)
      .eq("empresa_id", perfil.empresa_id)
      .single(),
    supabaseAdmin
      .from("facturas_electronicas")
      .select("id, numero_factus")
      .eq("venta_id", ventaId)
      .eq("estado", "validada")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!empresa) return { ok: false, error: "No se encontró la empresa." };
  if (empresa.responsable_iva === null) {
    return {
      ok: false,
      error: "Esta empresa todavía no tiene configurado si es responsable de IVA.",
    };
  }
  if (!venta) return { ok: false, error: "No se encontró la venta." };
  if (!facturaValidada?.numero_factus) {
    return { ok: false, error: "Esta venta no tiene una factura electrónica validada." };
  }

  // Si la factura ya se anuló, no tiene sentido agregarle un cargo más.
  const { data: notaCreditoExistente } = await supabaseAdmin
    .from("notas_credito_electronicas")
    .select("id")
    .eq("factura_electronica_id", facturaValidada.id)
    .eq("estado", "validada")
    .maybeSingle();
  if (notaCreditoExistente) {
    return { ok: false, error: "Esta factura ya fue anulada — no se le puede agregar una nota débito." };
  }

  const { data: integracion } = await supabaseAdmin
    .from("integraciones_factus")
    .select(
      "estado, numbering_range_id_notas_debito, factus_client_id, factus_client_secret, factus_username, factus_password",
    )
    .eq("empresa_id", perfil.empresa_id)
    .maybeSingle();

  if (
    !integracion ||
    integracion.estado !== "activa" ||
    !integracion.numbering_range_id_notas_debito ||
    !integracion.factus_client_id ||
    !integracion.factus_client_secret ||
    !integracion.factus_username ||
    !integracion.factus_password
  ) {
    return {
      ok: false,
      error:
        "Falta configurar el rango de numeración de notas débito de esta empresa — contáctanos.",
    };
  }

  // El documento del cliente (cédula/NIT) se lee de donde ya quedó
  // guardado al facturar la venta original (crm_contactos.atributos) —
  // nunca se vuelve a pedir, esta acción no tiene ese campo en su
  // formulario.
  let tipoDocumento = "13";
  let numeroDocumento = "";
  if (venta.contacto_id) {
    const { data: contacto } = await supabase
      .from("crm_contactos")
      .select("atributos")
      .eq("id", venta.contacto_id)
      .single();
    const atributos = (contacto?.atributos ?? {}) as Record<string, unknown>;
    if (typeof atributos.tipo_documento === "string") tipoDocumento = atributos.tipo_documento;
    if (typeof atributos.numero_documento === "string") numeroDocumento = atributos.numero_documento;
  }
  if (!numeroDocumento) {
    return { ok: false, error: "No se encontró el documento del cliente de esta venta." };
  }

  const responsableIva = empresa.responsable_iva === true;
  const nombreItem = input.descripcion.trim() || CONCEPTOS_NOTA_DEBITO[input.conceptoCode];
  // Un solo ítem "sintético" con el monto que se quiere cobrar — no sale
  // de ventas_items (no estaba en la venta original), así que se arma a
  // mano, pero reusando el mismo cálculo de IVA de siempre para que el
  // número que Factus reciba sea consistente con el resto de la empresa.
  const { items, monto } = construirItemsFactura(
    [{ id: "ajuste", item_id: null, nombre_libre: nombreItem, cantidad: 1, precio_unitario: input.monto }],
    new Map(),
    responsableIva,
  );

  // Fila 'pendiente' puesta ANTES de llamar a Factus, mismo criterio que
  // facturas_electronicas/notas_credito_electronicas.
  const { data: notaPendiente } = await supabaseAdmin
    .from("notas_debito_electronicas")
    .insert({
      factura_electronica_id: facturaValidada.id,
      estado: "pendiente",
      concepto_code: input.conceptoCode,
      descripcion: nombreItem,
      monto: input.monto,
    })
    .select("id")
    .single();

  let resultado: Awaited<ReturnType<typeof crearNotaDebitoFactus>>;
  try {
    resultado = await crearNotaDebitoFactus(
      {
        clientId: integracion.factus_client_id,
        clientSecret: integracion.factus_client_secret,
        username: integracion.factus_username,
        password: integracion.factus_password,
      },
      {
        billNumber: facturaValidada.numero_factus,
        numberingRangeId: integracion.numbering_range_id_notas_debito,
        referenceCode: crypto.randomUUID(),
        correctionConceptCode: input.conceptoCode,
        paymentDetails: [{ paymentForm: "1", paymentMethodCode: "10", amount: monto }],
        customer: {
          identificationDocumentCode: tipoDocumento,
          identification: numeroDocumento,
          names: venta.cliente_nombre ?? "Consumidor final",
          responsibilities: ["R-99-PN"],
          legalOrganizationCode: tipoDocumento === "31" ? "1" : undefined,
          company: tipoDocumento === "31" ? venta.cliente_nombre ?? "Consumidor final" : undefined,
        },
        items,
      },
    );
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "No se pudo conectar con Factus.";
    if (notaPendiente) {
      await supabaseAdmin
        .from("notas_debito_electronicas")
        .update({ estado: "rechazada", mensaje_error: mensaje })
        .eq("id", notaPendiente.id);
    }
    return { ok: false, error: mensaje };
  }

  if (!resultado.exitosa) {
    const detalle = formatearErroresFactus(resultado.errores);
    if (notaPendiente) {
      await supabaseAdmin
        .from("notas_debito_electronicas")
        .update({ estado: "rechazada", mensaje_error: detalle })
        .eq("id", notaPendiente.id);
    }
    return { ok: false, error: `Factus rechazó la nota débito: ${detalle}` };
  }

  if (notaPendiente) {
    await supabaseAdmin
      .from("notas_debito_electronicas")
      .update({
        estado: "validada",
        numero_factus: resultado.numero,
        cude: resultado.cude,
        link_publico: resultado.linkPublico,
        link_qr: resultado.linkQr,
      })
      .eq("id", notaPendiente.id);
  }

  // La nota débito ya quedó validada ante la DIAN por el monto completo
  // escrito (input.monto, no el "monto" ya ajustado por IVA que se le
  // mandó a Factus) — se le suma a ventas.monto para que esa venta (y
  // todos los reportes que ya la suman) reflejen el cargo extra. Sesión
  // normal: RLS en "ventas" ya limita esto a la propia empresa.
  const { error: errorIncrementar } = await supabase.rpc("incrementar_monto_venta", {
    p_venta_id: ventaId,
    p_monto: input.monto,
  });
  if (errorIncrementar) {
    return {
      ok: false,
      error: `La nota débito se generó correctamente ante la DIAN (número ${resultado.numero}), pero no se pudo sumar el monto a la venta en Datum: ${errorIncrementar.message}. Avísanos para corregirlo a mano.`,
    };
  }

  return {
    ok: true,
    numero: resultado.numero,
    linkPublico: resultado.linkPublico,
    linkQr: resultado.linkQr,
  };
}
