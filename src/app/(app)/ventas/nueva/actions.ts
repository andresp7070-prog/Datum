"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { crearYValidarFacturaFactus } from "@/lib/factus";

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

// Factus devuelve sus errores de validación campo por campo (ej.
// { identification: ["El número de documento no es válido"] }) — esto los
// junta en un texto legible, en vez de mostrar el JSON crudo o un mensaje
// genérico que no dice cuál fue el problema real.
function formatearErroresFactus(errores: unknown): string {
  if (typeof errores === "string") return errores;
  if (errores && typeof errores === "object") {
    const partes = Object.entries(errores as Record<string, unknown>).map(([campo, valor]) => {
      const texto = Array.isArray(valor) ? valor.join(", ") : String(valor);
      return `${campo}: ${texto}`;
    });
    if (partes.length > 0) return partes.join(" | ");
  }
  return JSON.stringify(errores);
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

  // Nunca confiar solo en que el check se mostró en el formulario — se
  // vuelve a confirmar del lado del servidor, mismo criterio que
  // requerirModulo() en src/lib/empresa.ts.
  const [{ data: empresa }, { data: venta }, { data: itemsVenta }] = await Promise.all([
    supabase
      .from("empresas")
      .select("factura_electronica_activa")
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
  // consumidor final. Factus, en cambio, espera el precio SIN IVA y él
  // mismo suma el 19% declarado en "taxes" para calcular el total — sin
  // este ajuste, Factus termina sumando IVA encima de un precio que ya lo
  // tenía, y el total que calcula no cuadra con lo que de verdad se cobró
  // (lo descubrimos probando: $70 cargados → Factus esperaba $83,30).
  const IVA_FACTURA = 0.19;
  const itemsFactura = itemsVenta.map((item) => {
    const precioConIva = Number(item.precio_unitario);
    const precioSinIva = Math.round((precioConIva / (1 + IVA_FACTURA)) * 100) / 100;
    return {
      codeReference: item.id,
      name: item.nombre_libre ?? nombrePorItem.get(item.item_id ?? "") ?? "Producto",
      quantity: Number(item.cantidad),
      price: precioSinIva,
      unitMeasureCode: "94",
      standardCode: "1",
      taxes: [{ code: "01", rate: 19 }],
    };
  });
  // El monto de payment_details tiene que cuadrar EXACTO con lo que Factus
  // calcula a partir de estos mismos items (base + IVA) — no alcanza con
  // reusar venta.monto directo, porque redondear el precio sin IVA a 2
  // decimales por ítem puede desviarlo unos centavos del total original.
  const montoFactura =
    Math.round(
      itemsFactura.reduce((suma, item) => suma + item.price * item.quantity * (1 + IVA_FACTURA), 0) * 100,
    ) / 100;

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
      .update({ estado: "validada", numero_factus: resultado.numero, cufe: resultado.cufe })
      .eq("id", facturaPendiente.id);
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

  return { ok: true, numero: resultado.numero, linkPublico: resultado.linkPublico, linkQr: resultado.linkQr };
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
