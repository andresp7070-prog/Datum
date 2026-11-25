"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  crearYValidarFacturaFactus,
  enviarFacturaPorCorreo,
  construirItemsFactura,
  formatearErroresFactus,
} from "@/lib/factus";

export type ClienteEncontrado = {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
};

export async function buscarClientes(query: string): Promise<ClienteEncontrado[]> {
  if (!query.trim()) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) return [];

  const { data, error } = await supabase.rpc("buscar_clientes", {
    p_empresa_id: perfil.empresa_id,
    p_query: query,
  });

  if (error) return [];
  return data ?? [];
}

// Documento guardado de un cliente que ya facturó electrónicamente antes
// (ver facturarVentaElectronicamente() más abajo, que es quien lo guarda
// en crm_contactos.atributos) — así "Agregar venta" puede prellenarlo en
// vez de pedirlo de nuevo cada vez. Sesión normal: RLS ya limita esto a
// los contactos de la propia empresa, no hace falta la llave de servicio.
export async function obtenerDocumentoCliente(
  contactoId: string,
): Promise<{ tipoDocumento: string | null; numeroDocumento: string | null }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_contactos")
    .select("atributos")
    .eq("id", contactoId)
    .single();

  const atributos = (data?.atributos ?? {}) as Record<string, unknown>;
  return {
    tipoDocumento: typeof atributos.tipo_documento === "string" ? atributos.tipo_documento : null,
    numeroDocumento: typeof atributos.numero_documento === "string" ? atributos.numero_documento : null,
  };
}

// Cuántas unidades del producto de una promoción de fidelidad lleva
// compradas este cliente desde su último regalo — se calcula desde el
// historial real de ventas cada vez que se pide, nunca se guarda aparte.
export async function obtenerProgresoFidelidad(
  contactoId: string,
  promocionId: string,
): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data, error } = await supabase.rpc("progreso_fidelidad", {
    p_promocion_id: promocionId,
    p_contacto_id: contactoId,
  });

  if (error) return 0;
  return (data as number) ?? 0;
}

export type ItemVentaInput = {
  itemId: string | null;
  nombreLibre: string | null;
  costoUnitario: number | null;
  cantidad: number;
  precioUnitario: number;
  promocionId: string | null;
  descuentoAplicado: number;
};

export async function guardarVenta(input: {
  contactoId: string | null;
  clienteNombre: string;
  clienteTelefono: string;
  clienteEmail: string;
  fecha: string;
  metodoPago: string;
  items: ItemVentaInput[];
  puntoVentaId?: string | null;
}): Promise<{ error: string | null; ventaId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return { error: "Tu usuario no tiene una empresa asignada." };
  }

  const { data: ventaId, error } = await supabase.rpc("registrar_venta", {
    p_empresa_id: perfil.empresa_id,
    p_contacto_id: input.contactoId,
    p_cliente_nombre: input.clienteNombre,
    p_cliente_telefono: input.clienteTelefono,
    p_cliente_email: input.clienteEmail || null,
    p_atributos_cliente: {},
    p_atributos_venta: {},
    p_items: input.items.map((item) => ({
      item_id: item.itemId,
      nombre_libre: item.nombreLibre,
      costo_unitario: item.costoUnitario,
      cantidad: item.cantidad,
      precio_unitario: item.precioUnitario,
      promocion_id: item.promocionId,
      descuento_aplicado: item.descuentoAplicado,
    })),
    p_fecha: input.fecha,
    p_metodo_pago: input.metodoPago,
    p_punto_venta_id: input.puntoVentaId ?? null,
  });

  if (error) return { error: error.message };
  return { error: null, ventaId: ventaId as string };
}

export type ItemApartadoInput = {
  itemId: string | null;
  nombreLibre: string | null;
  costoUnitario: number | null;
  cantidad: number;
  precioUnitario: number;
};

export async function registrarApartado(input: {
  contactoId: string | null;
  clienteNombre: string;
  clienteTelefono: string;
  clienteEmail: string;
  montoInicial: number;
  items: ItemApartadoInput[];
  puntoVentaId?: string | null;
}): Promise<{ error: string | null; apartadoId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return { error: "Tu usuario no tiene una empresa asignada." };
  }

  const { data: apartadoId, error } = await supabase.rpc("registrar_apartado", {
    p_empresa_id: perfil.empresa_id,
    p_contacto_id: input.contactoId,
    p_cliente_nombre: input.clienteNombre,
    p_cliente_telefono: input.clienteTelefono,
    p_cliente_email: input.clienteEmail || null,
    p_items: input.items.map((item) => ({
      item_id: item.itemId,
      nombre_libre: item.nombreLibre,
      costo_unitario: item.costoUnitario,
      cantidad: item.cantidad,
      precio_unitario: item.precioUnitario,
    })),
    p_monto_inicial: input.montoInicial,
    p_punto_venta_id: input.puntoVentaId ?? null,
  });

  if (error) return { error: error.message };
  return { error: null, apartadoId: apartadoId as string };
}

export type DocumentoFacturaInput = {
  // Código de tipo de documento de la DIAN — "13" cédula de ciudadanía o
  // "31" NIT. Son los dos realistas para una pyme vendiéndole a personas
  // o a otras empresas; si hace falta otro, se agrega cuando se presente.
  tipoDocumento: string;
  numeroDocumento: string;
};

// Factura electrónicamente una venta YA guardada — segundo paso, aparte
// de guardarVenta(), nunca mezclado con ese: si esto falla, la venta ya
// quedada guardada igual, nunca se revierte por esto (ver CLAUDE.md).
export async function facturarVentaElectronicamente(
  ventaId: string,
  documento: DocumentoFacturaInput,
  clienteTelefono: string,
  clienteEmail: string,
): Promise<
  | {
      ok: true;
      numero: string;
      linkPublico: string;
      linkQr: string;
      // "sin_correo" cuando el cliente no dejó correo en Ventas (es
      // opcional) — no es un error, simplemente no había a quién enviarle.
      estadoCorreo: "enviado" | "fallido" | "sin_correo";
      // Motivo real de Factus cuando estadoCorreo es "fallido" — se
      // muestra tal cual en vez de un mensaje genérico, mismo criterio que
      // formatearErroresFactus() para la factura misma. Útil mientras este
      // envío no esté confirmado contra el sandbox real.
      detalleErrorCorreo?: string;
    }
  | { ok: false; error: string }
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

  // Nunca confiar solo en que el check se mostró en el formulario — se
  // vuelve a confirmar del lado del servidor, mismo criterio que
  // requerirModulo() en src/lib/empresa.ts.
  const [{ data: empresa }, { data: venta }, { data: itemsVenta }] = await Promise.all([
    supabase
      .from("empresas")
      .select("factura_electronica_activa, responsable_iva")
      .eq("id", perfil.empresa_id)
      .single(),
    supabase
      .from("ventas")
      .select("numero_venta, monto, cliente_nombre, contacto_id")
      .eq("id", ventaId)
      .eq("empresa_id", perfil.empresa_id)
      .single(),
    supabase
      .from("ventas_items")
      .select("id, item_id, nombre_libre, cantidad, precio_unitario")
      .eq("venta_id", ventaId),
  ]);

  if (!empresa?.factura_electronica_activa) {
    return { ok: false, error: "Facturación electrónica no está activa para tu empresa." };
  }
  // Nunca se asume ni true ni false por defecto — si nadie lo configuró
  // todavía (null), no se deja facturar. Ver CLAUDE.md: activarlo con el
  // valor equivocado no sería solo un número mal calculado, sería una
  // factura electrónica ante la DIAN con un impuesto que no le
  // corresponde a esa empresa.
  if (empresa.responsable_iva === null) {
    return {
      ok: false,
      error: "Esta empresa todavía no tiene configurado si es responsable de IVA — contáctanos para activarlo.",
    };
  }
  if (!venta) {
    return { ok: false, error: "No se encontró la venta." };
  }
  if (!itemsVenta || itemsVenta.length === 0) {
    return { ok: false, error: "La venta no tiene productos para facturar." };
  }

  // Los nombres de los productos del catálogo no viven en ventas_items
  // (solo precio/costo quedan congelados ahí) — se resuelven aparte, para
  // no depender de cómo tipe Supabase una relación anidada.
  const idsCatalogo = itemsVenta
    .map((item) => item.item_id)
    .filter((id): id is string => Boolean(id));
  const { data: catalogo } =
    idsCatalogo.length > 0
      ? await supabase.from("inventario_items").select("id, nombre").in("id", idsCatalogo)
      : { data: [] as { id: string; nombre: string }[] };
  const nombrePorItem = new Map((catalogo ?? []).map((c) => [c.id, c.nombre]));

  // integraciones_factus guarda las credenciales de la cuenta de Factus de
  // ESTA empresa — RLS "solo admin", la sesión normal del cliente no puede
  // leerla. Octavo uso legítimo de la llave de servicio (ver
  // src/lib/supabase/admin.ts).
  const supabaseAdmin = createAdminClient();
  const { data: integracion } = await supabaseAdmin
    .from("integraciones_factus")
    .select(
      "estado, numbering_range_id, factus_client_id, factus_client_secret, factus_username, factus_password",
    )
    .eq("empresa_id", perfil.empresa_id)
    .maybeSingle();

  if (
    !integracion ||
    integracion.estado !== "activa" ||
    !integracion.numbering_range_id ||
    !integracion.factus_client_id ||
    !integracion.factus_client_secret ||
    !integracion.factus_username ||
    !integracion.factus_password
  ) {
    return { ok: false, error: "Facturación electrónica no está configurada correctamente." };
  }

  // Fila 'pendiente' puesta ANTES de llamar a Factus — si la función se
  // cae a mitad de camino, queda el registro de que se intentó (ver
  // schema.sql, tabla facturas_electronicas).
  const { data: facturaPendiente } = await supabaseAdmin
    .from("facturas_electronicas")
    .insert({ venta_id: ventaId, estado: "pendiente" })
    .select("id")
    .single();

  // El precio cargado en Datum (ventas_items.precio_unitario) ya incluye
  // el IVA — confirmado con Andrés, 2026-11-20, es el precio final que de
  // verdad cobra el negocio, como es lo normal en Colombia para
  // consumidor final — PERO solo si la empresa es responsable de IVA. Si
  // no lo es (empresa.responsable_iva === false, ya validado arriba que
  // no es null), nunca hubo IVA que restar, y la factura se manda
  // marcada como excluida en vez de con el impuesto 01 al 19% (ver
  // isExcluded en src/lib/factus.ts). Para una responsable, Factus espera
  // el precio SIN IVA y él mismo suma el 19% declarado en "taxes" para
  // calcular el total — sin ese ajuste, Factus termina sumando IVA
  // encima de un precio que ya lo tenía (lo descubrimos probando: $70
  // cargados → Factus esperaba $83,30).
  const responsableIva = empresa.responsable_iva === true;
  const { items: itemsFactura, monto: montoFactura } = construirItemsFactura(
    itemsVenta,
    nombrePorItem,
    responsableIva,
  );

  // Valores genéricos del catálogo de la DIAN, confirmados contra el
  // sandbox real de Factus (ver src/lib/factus.ts) — pendiente confirmar
  // con Andrés antes de facturarle a un cliente real que pague con algo
  // distinto a efectivo, o que sea una empresa (NIT) en vez de una
  // persona natural.
  //
  // Esta llamada sí puede LANZAR una excepción (no solo devolver
  // "exitosa: false") — ej. si falta la variable de entorno
  // FACTUS_BASE_URL, o si las credenciales de esta empresa en
  // integraciones_factus no sirven para conectar con Factus
  // (obtenerTokenFactus() en src/lib/factus.ts lanza en ambos casos). Sin
  // este try/catch, esa excepción se escapaba del Server Action y Next.js
  // la mostraba como un mensaje genérico ("Server Components render...",
  // sin detalle) — nunca decía cuál de las dos cosas había fallado.
  let resultado: Awaited<ReturnType<typeof crearYValidarFacturaFactus>>;
  try {
    resultado = await crearYValidarFacturaFactus(
      {
        clientId: integracion.factus_client_id,
        clientSecret: integracion.factus_client_secret,
        username: integracion.factus_username,
        password: integracion.factus_password,
      },
      {
        numberingRangeId: integracion.numbering_range_id,
        // El id (UUID) de la venta, no numero_venta — ver el hallazgo real
        // en CLAUDE.md: numero_venta es un entero chiquito (1, 2, 3...) por
        // empresa, y esta cuenta de sandbox la comparten desarrolladores de
        // todo el mundo. Si Factus usa reference_code para evitar facturas
        // duplicadas, un número tan simple choca fácil con el de cualquier
        // otra prueba ajena, y Factus devuelve LA FACTURA QUE YA EXISTÍA con
        // ese código en vez de crear una nueva — exactamente lo que
        // explicaba por qué las facturas de prueba salían con datos de otra
        // persona. El UUID de la venta es, en la práctica, único a nivel
        // global, así que no corre ese riesgo.
        referenceCode: ventaId,
        paymentDetails: [{ paymentForm: "1", paymentMethodCode: "10", amount: montoFactura }],
        customer: {
          identificationDocumentCode: documento.tipoDocumento,
          identification: documento.numeroDocumento,
          names: venta.cliente_nombre ?? "Consumidor final",
          responsibilities: ["R-99-PN"],
          email: clienteEmail || undefined,
          phone: clienteTelefono || undefined,
          // Factus lo exige cuando el documento es NIT ("31") — ver
          // src/lib/factus.ts. "1" = Persona Jurídica, el supuesto más
          // razonable para un cliente identificado por NIT.
          legalOrganizationCode: documento.tipoDocumento === "31" ? "1" : undefined,
          // Razón social — también exigido para NIT. Acá solo hay un
          // nombre de cliente (no se distingue "contacto" de "razón
          // social" en el formulario), así que se manda el mismo valor.
          company:
            documento.tipoDocumento === "31" ? venta.cliente_nombre ?? "Consumidor final" : undefined,
        },
        items: itemsFactura,
      },
    );
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "No se pudo conectar con Factus.";
    if (facturaPendiente) {
      await supabaseAdmin
        .from("facturas_electronicas")
        .update({ estado: "rechazada", mensaje_error: mensaje })
        .eq("id", facturaPendiente.id);
    }
    return { ok: false, error: mensaje };
  }

  if (!resultado.exitosa) {
    const detalle = formatearErroresFactus(resultado.errores);
    if (facturaPendiente) {
      await supabaseAdmin
        .from("facturas_electronicas")
        .update({ estado: "rechazada", mensaje_error: detalle })
        .eq("id", facturaPendiente.id);
    }
    return { ok: false, error: `Factus rechazó la factura: ${detalle}` };
  }

  if (facturaPendiente) {
    await supabaseAdmin
      .from("facturas_electronicas")
      .update({
        estado: "validada",
        numero_factus: resultado.numero,
        cufe: resultado.cufe,
        // Enlaces ya gratuitos y permanentes de Factus y la DIAN — se
        // guardan para poder revisar la factura más adelante (ver "Ver
        // factura" en el historial de Ventas) sin que Datum tenga que
        // guardar ningún PDF/XML propio.
        link_publico: resultado.linkPublico,
        link_qr: resultado.linkQr,
      })
      .eq("id", facturaPendiente.id);
  }

  // Factus puede mandarle la factura por correo al cliente directamente —
  // automático, solo si quedó un correo (es opcional en "Agregar venta").
  // Si este paso falla, no se revierte nada de lo anterior: la factura YA
  // quedó validada ante la DIAN, que es lo que importa legalmente — solo
  // se le avisa a quien registró que el correo no salió, para que lo
  // reenvíe por otro medio si hace falta.
  let estadoCorreo: "enviado" | "fallido" | "sin_correo" = "sin_correo";
  let detalleErrorCorreo: string | undefined;
  if (clienteEmail) {
    try {
      await enviarFacturaPorCorreo(
        {
          clientId: integracion.factus_client_id,
          clientSecret: integracion.factus_client_secret,
          username: integracion.factus_username,
          password: integracion.factus_password,
        },
        resultado.numero,
        clienteEmail,
      );
      estadoCorreo = "enviado";
    } catch (err) {
      estadoCorreo = "fallido";
      detalleErrorCorreo = err instanceof Error ? err.message : "Error desconocido.";
    }
  }

  // Guarda el documento en el contacto, para no volver a pedirlo la
  // próxima vez que compre y facture — todavía no hay ninguna pantalla
  // que lo PRELLENE sola (queda para un paso siguiente), pero el dato ya
  // queda disponible desde ahora. Sesión normal: RLS ya limita esto a la
  // propia empresa.
  if (venta.contacto_id) {
    const { data: contacto } = await supabase
      .from("crm_contactos")
      .select("atributos")
      .eq("id", venta.contacto_id)
      .single();
    await supabase
      .from("crm_contactos")
      .update({
        atributos: {
          ...(contacto?.atributos ?? {}),
          tipo_documento: documento.tipoDocumento,
          numero_documento: documento.numeroDocumento,
        },
      })
      .eq("id", venta.contacto_id);
  }

  return {
    ok: true,
    numero: resultado.numero,
    linkPublico: resultado.linkPublico,
    linkQr: resultado.linkQr,
    estadoCorreo,
    detalleErrorCorreo,
  };
}

export async function deshacerVenta(ventaId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { error } = await supabase.rpc("deshacer_venta", { p_venta_id: ventaId });

  if (error) return { error: error.message };
  return { error: null };
}
