"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { crearNotaCreditoFactus, construirItemsFactura, formatearErroresFactus } from "@/lib/factus";

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

  return {
    ok: true,
    numero: resultado.numero,
    linkPublico: resultado.linkPublico,
    linkQr: resultado.linkQr,
  };
}
