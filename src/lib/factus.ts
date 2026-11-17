// Integración con Factus (facturación electrónica ante la DIAN) — ver
// CLAUDE.md, sección "Facturación electrónica — Factus". Código propio
// contra la API REST de Factus (fetch directo, sin SDK), mismo criterio
// que src/lib/wompi.ts y src/lib/google.ts.
//
// Cinco variables de entorno, todavía sin poner en Vercel (ver
// CLAUDE.md, "Pendientes" — el siguiente paso es ponerlas ahí cuando se
// empiece a conectar esto a una pantalla real):
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
// Todo lo de este archivo quedó confirmado contra el sandbox real
// (2026-11-17) creando y validando una factura completa de punta a
// punta, no adivinado de la documentación: los nombres de los campos se
// aprendieron mandando cuerpos incompletos a propósito y leyendo los
// errores de validación de Factus (siempre dicen qué campo falta), y la
// forma de la respuesta exitosa, el PDF y el XML se confirmaron con una
// factura real (de prueba) que sí llegó a validarse ante la DIAN.
//
// Hallazgo importante probando esto: cada intento contra
// /v2/bills/validate consume un número real del rango de numeración
// compartido — y la cuenta de sandbox usada (sandboxv2@factus.com.co)
// parece compartida con otros desarrolladores probando la misma API, no
// exclusiva de Datum (el contador subió mucho más de lo que las propias
// pruebas de acá explican). No es una sandbox "de mentira" sin costo —
// cada factura de prueba real cuenta.
//
// Los códigos del catálogo de la DIAN (tipo de documento, responsabilidad
// fiscal, unidad de medida, estándar de codificación, impuestos, forma y
// método de pago) nunca se inventan acá — cada función los recibe como
// parámetro. La prueba real que confirmó este archivo usó códigos
// genéricos razonables (cédula de ciudadanía, "No responsable" R-99-PN,
// unidad, UNSPSC, IVA 19%, pago de contado en efectivo) que sí
// funcionaron contra el sandbox, pero hay que confirmar con Andrés los
// valores correctos para cada caso real antes de facturarle a un
// cliente de verdad.

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
  // Código del impuesto en el catálogo de Factus/la DIAN (ej. "01" =
  // IVA, el que se usó en la prueba real) — viene de ese catálogo,
  // nunca se inventa acá.
  code: string;
  rate: number; // tarifa, ej. 19 para 19%
}

export interface ItemFactura {
  codeReference: string; // referencia/SKU propio del ítem (puede ser el id de inventario_items)
  name: string;
  quantity: number;
  price: number; // precio unitario
  // Código de unidad de medida del catálogo de la DIAN (ej. "94" =
  // unidad, el que se usó en la prueba real) — nunca se inventa acá.
  unitMeasureCode: string;
  // Código del estándar de codificación del ítem — ej. "1" = UNSPSC
  // (el que se usó en la prueba real) — nunca se inventa acá.
  standardCode: string;
  taxes: ImpuestoItemFactura[];
  discount?: number;
}

export interface ClienteFactura {
  // Código de tipo de documento del catálogo de la DIAN — ej. "13" =
  // cédula de ciudadanía (el que se usó en la prueba real) — nunca se
  // inventa acá.
  identificationDocumentCode: string;
  identification: string; // número de documento
  names: string;
  // Responsabilidades fiscales del catálogo de la DIAN — confirmado que
  // es un arreglo de códigos (ej. ["R-99-PN"] = No responsable, el que
  // se usó en la prueba real).
  responsibilities: string[];
  email?: string;
  phone?: string;
  address?: string;
}

export interface DetallePagoFactura {
  // Forma de pago del catálogo de la DIAN — ej. "1" = pago de contado
  // (el que se usó en la prueba real).
  paymentForm: string;
  // Método de pago del catálogo de la DIAN — ej. "10" = efectivo (el
  // que se usó en la prueba real).
  paymentMethodCode: string;
  amount: number; // cuánto se paga con este método — permite pagos repartidos entre varios
}

export interface FacturaFactusInput {
  numberingRangeId: number;
  // Referencia propia de Datum para esta factura (ej. el numero_venta) —
  // así se puede referenciar sin usar el id técnico de Factus.
  referenceCode: string;
  // Confirmado que es un arreglo, no un objeto — mandarlo como objeto
  // (como se intentó al principio) produce errores de validación
  // confusos, porque Factus lo interpreta como un arreglo con las
  // claves del objeto como índices.
  paymentDetails: DetallePagoFactura[];
  customer: ClienteFactura;
  items: ItemFactura[];
}

export interface FacturaFactusExitosa {
  exitosa: true;
  // El número oficial que le asigna Factus (prefijo + consecutivo, ej.
  // "SETP990037334") — es lo que identifica la factura en
  // descargarPdfFactura()/descargarXmlFactura(), no el reference_code
  // propio de Datum.
  numero: string;
  cufe: string;
  linkQr: string; // página de verificación pública de la DIAN
  linkPublico: string; // página de Factus donde se puede ver el documento
  // Avisos de la propia DIAN que pueden venir incluso con la factura ya
  // validada (ej. que el documento de identidad no coincide con el RUT)
  // — no significan que la factura haya fallado, is_validated es la
  // señal real de éxito. Quedan acá para poder mostrarlos si hace falta.
  avisosDian: Record<string, string>;
  data: unknown; // la respuesta completa de Factus, por si se necesita algo no extraído acá
}

export interface FacturaFactusFallida {
  exitosa: false;
  errores: unknown; // los errores de validación que devuelve Factus, campo por campo
  data: unknown;
}

// Crea y valida una factura electrónica — Factus la firma y transmite a
// la DIAN en esta misma llamada (no es un borrador, ver CLAUDE.md).
export async function crearYValidarFacturaFactus(
  input: FacturaFactusInput,
): Promise<FacturaFactusExitosa | FacturaFactusFallida> {
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
      payment_details: input.paymentDetails.map((detalle) => ({
        payment_form: detalle.paymentForm,
        payment_method_code: detalle.paymentMethodCode,
        amount: detalle.amount,
      })),
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
  if (!respuesta.ok || !cuerpo.data?.is_validated) {
    return { exitosa: false, errores: cuerpo.data?.errors ?? cuerpo.data, data: cuerpo.data };
  }
  return {
    exitosa: true,
    numero: cuerpo.data.number,
    cufe: cuerpo.data.cufe,
    linkQr: cuerpo.data.links?.qr,
    linkPublico: cuerpo.data.links?.public_url,
    avisosDian: cuerpo.data.errors ?? {},
    data: cuerpo.data,
  };
}

// Descarga el PDF de una factura YA validada — Factus lo entrega como
// texto en base64 dentro del JSON, no como un archivo binario directo
// ni como una URL para descargar después; hay que decodificarlo del
// lado de quien llame esta función. "numero" es el que asignó Factus
// (ej. "SETP990037334"), no el reference_code propio de Datum.
export async function descargarPdfFactura(
  numero: string,
): Promise<{ nombreArchivo: string; pdfBase64: string }> {
  const baseUrl = variableRequerida("FACTUS_BASE_URL");
  const token = await obtenerTokenFactus();
  const respuesta = await fetch(`${baseUrl}/v2/bills/${numero}/download-pdf`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const cuerpo = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(cuerpo.message ?? "No se pudo descargar el PDF de la factura.");
  }
  return { nombreArchivo: cuerpo.data.file_name, pdfBase64: cuerpo.data.pdf_base_64_encoded };
}

// Mismo patrón que descargarPdfFactura(), confirmado igual contra el
// sandbox real.
export async function descargarXmlFactura(
  numero: string,
): Promise<{ nombreArchivo: string; xmlBase64: string }> {
  const baseUrl = variableRequerida("FACTUS_BASE_URL");
  const token = await obtenerTokenFactus();
  const respuesta = await fetch(`${baseUrl}/v2/bills/${numero}/download-xml`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const cuerpo = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(cuerpo.message ?? "No se pudo descargar el XML de la factura.");
  }
  return { nombreArchivo: cuerpo.data.file_name, xmlBase64: cuerpo.data.xml_base_64_encoded };
}
