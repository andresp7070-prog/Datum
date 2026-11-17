// Integración con Factus (facturación electrónica ante la DIAN) — ver
// CLAUDE.md, sección "Facturación electrónica — Factus". Código propio
// contra la API REST de Factus (fetch directo, sin SDK), mismo criterio
// que src/lib/wompi.ts y src/lib/google.ts.
//
// Cinco variables de entorno, todavía sin poner en Vercel (ver
// CLAUDE.md, "Pendientes" — el siguiente paso es ponerlas ahí cuando se
// empiece a probar esto contra una pantalla real):
// - FACTUS_BASE_URL — distinta por ambiente, mismo criterio que
//   NEXT_PUBLIC_SUPABASE_URL: en Preview, la de sandbox
//   (https://api-sandbox.factus.com.co); en producción, la real
//   (https://api.factus.com.co). A diferencia de Wompi, las
//   credenciales de Factus no traen ningún prefijo que permita adivinar
//   el ambiente solo mirándolas, así que acá sí hace falta leer el host
//   de una variable aparte, en vez de calcularlo.
// - FACTUS_CLIENT_ID
// - FACTUS_CLIENT_SECRET
// - FACTUS_USERNAME — el correo de la cuenta de Factus
// - FACTUS_PASSWORD
//
// OJO — lo que SÍ está confirmado contra el sandbox real (2026-11-17) y
// lo que NO:
// - Login y el rango de numeración (ver obtenerTokenFactus) están
//   confirmados de punta a punta.
// - Los nombres de los campos de crearYValidarFacturaFactus() están
//   confirmados mandando cuerpos incompletos a propósito y leyendo los
//   errores de validación que devuelve Factus (siempre dice qué campo
//   falta) — no son una suposición.
// - Lo que NO está confirmado: la forma exacta de customer.responsibilities
//   y items[].taxes (¿arreglo de qué forma exacta?), la forma de
//   payment_details, y la respuesta cuando una factura SÍ se valida con
//   éxito — un intento con datos de relleno no llegó a un 422 sino a un
//   500 (error interno de Factus), así que no se pudo aprender nada ahí.
// - Los códigos del catálogo de la DIAN (tipo de documento, responsabilidad
//   fiscal, unidad de medida, estándar de codificación, impuestos) nunca
//   se inventan acá — cada función los recibe como parámetro, para que
//   se usen los códigos reales del catálogo de Factus/la DIAN, no un
//   valor de ejemplo puesto a mano.
// - Importante para cuando se vuelva a probar: cada intento contra
//   /v2/bills/validate consume un número real del rango compartido —
//   confirmado viendo que el "current" del rango subió incluso con un
//   intento que terminó en error 500. No es una sandbox "de mentira" sin
//   costo — hay que probar con cuidado, no a prueba y error.

function variableRequerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta configurar la variable de entorno ${nombre}`);
  return valor;
}

// Pide un token nuevo cada vez que se llama, sin cachearlo entre
// llamadas — mismo criterio que obtenerTokensAceptacionWompi() en
// wompi.ts: más simple que mantener un caché, y el token dura 1 hora
// (confirmado contra el sandbox real, 2026-11-17), tiempo de sobra para
// cualquier operación puntual de este archivo.
async function obtenerTokenFactus(): Promise<string> {
  const baseUrl = variableRequerida("FACTUS_BASE_URL");
  const respuesta = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: variableRequerida("FACTUS_CLIENT_ID"),
      client_secret: variableRequerida("FACTUS_CLIENT_SECRET"),
      username: variableRequerida("FACTUS_USERNAME"),
      password: variableRequerida("FACTUS_PASSWORD"),
    }),
  });
  const cuerpo = await respuesta.json();
  if (!respuesta.ok || !cuerpo.access_token) {
    throw new Error(cuerpo.error_description ?? "No se pudo conectar con Factus.");
  }
  return cuerpo.access_token as string;
}

export interface ImpuestoItemFactura {
  // Código del impuesto en el catálogo de Factus/la DIAN (ej. el del
  // IVA) — viene de ese catálogo, nunca se inventa acá.
  code: string;
  rate: number; // tarifa, ej. 19 para 19%
}

export interface ItemFactura {
  codeReference: string; // referencia/SKU propio del ítem (puede ser el id de inventario_items)
  name: string;
  quantity: number;
  price: number; // precio unitario
  // Código de unidad de medida del catálogo de la DIAN — nunca se
  // inventa acá, viene de ese catálogo.
  unitMeasureCode: string;
  // Código del estándar de codificación del ítem (ej. UNSPSC) del
  // catálogo de la DIAN — nunca se inventa acá.
  standardCode: string;
  taxes: ImpuestoItemFactura[];
  discount?: number;
}

export interface ClienteFactura {
  // Código de tipo de documento del catálogo de la DIAN (ej. cédula de
  // ciudadanía) — nunca se inventa acá.
  identificationDocumentCode: string;
  identification: string; // número de documento
  names: string;
  // Responsabilidades fiscales del catálogo de la DIAN — forma exacta
  // (¿arreglo de códigos, o algo distinto?) todavía sin confirmar contra
  // una respuesta real, ver la nota al principio del archivo.
  responsibilities: string[];
  email?: string;
  phone?: string;
  address?: string;
}

export interface FacturaFactusInput {
  numberingRangeId: number;
  // Referencia propia de Datum para esta factura (ej. el numero_venta) —
  // así se puede referenciar sin usar el id técnico de Factus.
  referenceCode: string;
  // Forma exacta todavía sin confirmar (ver la nota al principio del
  // archivo) — se manda tal cual lo entregue quien llame esta función.
  paymentDetails: Record<string, unknown>;
  customer: ClienteFactura;
  items: ItemFactura[];
}

// Crea y valida una factura electrónica — Factus la firma y transmite a
// la DIAN en esta misma llamada (no es un borrador, ver CLAUDE.md). La
// forma de la respuesta cuando SÍ se valida con éxito todavía no está
// confirmada (ver la nota al principio del archivo) — por eso esta
// función devuelve el cuerpo completo de data tal cual lo entrega
// Factus, en vez de extraer campos puntuales que todavía no se sabe si
// existen con ese nombre.
export async function crearYValidarFacturaFactus(
  input: FacturaFactusInput,
): Promise<{ exitosa: boolean; data: unknown; errores?: unknown }> {
  const baseUrl = variableRequerida("FACTUS_BASE_URL");
  const token = await obtenerTokenFactus();

  const respuesta = await fetch(`${baseUrl}/v2/bills/validate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      numbering_range_id: input.numberingRangeId,
      reference_code: input.referenceCode,
      payment_details: input.paymentDetails,
      customer: {
        identification_document_code: input.customer.identificationDocumentCode,
        identification: input.customer.identification,
        names: input.customer.names,
        responsibilities: input.customer.responsibilities,
        ...(input.customer.email ? { email: input.customer.email } : {}),
        ...(input.customer.phone ? { phone: input.customer.phone } : {}),
        ...(input.customer.address ? { address: input.customer.address } : {}),
      },
      items: input.items.map((item) => ({
        code_reference: item.codeReference,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        unit_measure_code: item.unitMeasureCode,
        standard_code: item.standardCode,
        taxes: item.taxes,
        ...(item.discount ? { discount: item.discount } : {}),
      })),
    }),
  });

  const cuerpo = await respuesta.json();
  if (!respuesta.ok) {
    return { exitosa: false, data: cuerpo.data, errores: cuerpo.data?.errors };
  }
  return { exitosa: true, data: cuerpo.data };
}
