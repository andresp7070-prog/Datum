// Integración con Wompi (cobro automático de suscripciones) — ver
// CLAUDE.md, sección "Cobros". Código propio contra la API REST de Wompi
// (fetch directo, sin SDK), mismo criterio que src/lib/google.ts.
//
// Wompi usa la misma URL para Sandbox y Producción — lo que cambia es el
// prefijo de las llaves (pub_test_/prv_test_ vs pub_prod_/prv_prod_), así
// que el ambiente se decide poniendo un juego de llaves u otro en Vercel,
// nunca en este código.
//
// Hay CUATRO credenciales distintas, todas del Dashboard de Wompi, nunca
// la misma: la llave pública y la privada (Mi cuenta → esa sección), el
// Secreto de Eventos y el Secreto de Integridad (los dos viven en Mi
// cuenta → Secretos para integración técnica). En Vercel quedaron
// guardadas con nombre en español, no el inglés que se usa en el resto
// del proyecto (GOOGLE_CLIENT_ID, etc.) — ya están puestas así, no hace
// falta cambiarlas:
// - LLAVE_PUBLICA_WOMPI
// - LLAVE_PRIVADA_WOMPI
// - SECRETO_EVENTOS_WOMPI
// - INTEGRIDAD_EVENTOS_WOMPI (el Secreto de Integridad, a pesar del
//   nombre — quedó así por como se creó en Vercel)

const WOMPI_API_BASE = "https://api.wompi.co/v1";

function variableRequerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta configurar la variable de entorno ${nombre}`);
  return valor;
}

async function sha256Hex(texto: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Paso previo obligatorio antes de crear una fuente de pago o una
// transacción nueva (ver "Tokens de aceptación" en la documentación de
// Wompi): sus propios términos de uso y su autorización de tratamiento de
// datos personales, aparte del contrato de Datum (ya se acepta en
// /aceptar-terminos). Los tokens son prefirmados y expiran pronto, así
// que siempre hay que pedirlos justo antes de usarlos, nunca guardarlos.
export async function obtenerTokensAceptacionWompi(): Promise<{
  acceptanceToken: string;
  acceptPersonalAuth: string;
  permalinkTerminos: string;
  permalinkDatosPersonales: string;
}> {
  const llavePublica = variableRequerida("LLAVE_PUBLICA_WOMPI");
  const respuesta = await fetch(`${WOMPI_API_BASE}/merchants/info`, {
    headers: { "x-merchant-public-key": llavePublica },
  });
  if (!respuesta.ok) {
    throw new Error("No se pudieron obtener los términos de Wompi en este momento.");
  }
  const cuerpo = await respuesta.json();
  return {
    acceptanceToken: cuerpo.data.presigned_acceptance.acceptance_token,
    acceptPersonalAuth: cuerpo.data.presigned_personal_data_auth.acceptance_token,
    permalinkTerminos: cuerpo.data.presigned_acceptance.permalink,
    permalinkDatosPersonales: cuerpo.data.presigned_personal_data_auth.permalink,
  };
}

// Paso 2 de "Fuentes de pago": convierte el token de la tarjeta (el que
// entrega el Widget de tokenización de Wompi, nunca la tarjeta en sí) en
// una fuente de pago reutilizable — el cliente la acepta explícitamente
// una sola vez, acá; cobrarle el mes siguiente ya no necesita que vuelva
// a escribir nada (ver crearCobroRecurrenteWompi). sessionId/deviceId
// vienen de Wompi JS (su librería antifraude, que corre en el navegador
// de quien está agregando la tarjeta) — opcionales, pero Wompi recomienda
// mandarlos siempre que se pueda para mejorar la detección de fraude.
export async function crearFuentePagoWompi(input: {
  tokenTarjeta: string;
  correoCliente: string;
  acceptanceToken: string;
  acceptPersonalAuth: string;
  sessionId?: string;
  deviceId?: string;
}): Promise<{ id: number; estado: string }> {
  const llavePrivada = variableRequerida("LLAVE_PRIVADA_WOMPI");
  const respuesta = await fetch(`${WOMPI_API_BASE}/payment_sources`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${llavePrivada}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "CARD",
      token: input.tokenTarjeta,
      customer_email: input.correoCliente,
      acceptance_token: input.acceptanceToken,
      accept_personal_auth: input.acceptPersonalAuth,
      ...(input.sessionId ? { session_id: input.sessionId } : {}),
      ...(input.deviceId ? { customer_data: { device_id: input.deviceId } } : {}),
    }),
  });
  const cuerpo = await respuesta.json();
  if (!respuesta.ok || cuerpo.data?.status !== "AVAILABLE") {
    throw new Error(cuerpo.error?.reason ?? "No se pudo guardar el método de pago.");
  }
  return { id: cuerpo.data.id, estado: cuerpo.data.status };
}

// La "firma de integridad" que exige cada transacción nueva — no confirmada
// contra la documentación real todavía (no se encontró esa página), armada
// por analogía con el mismo patrón que sí confirmamos para los webhooks
// (concatenar datos + un secreto, y sacar SHA256). Si Wompi la rechaza al
// probar en sandbox, es la primera cosa a revisar.
async function firmaIntegridadWompi(input: {
  referencia: string;
  montoEnCentavos: number;
  moneda: string;
}): Promise<string> {
  const secreto = variableRequerida("INTEGRIDAD_EVENTOS_WOMPI");
  return sha256Hex(`${input.referencia}${input.montoEnCentavos}${input.moneda}${secreto}`);
}

// Cobro automático contra una fuente de pago ya creada (mes 2 en
// adelante, o el primer cobro si no hay período de prueba de por medio) —
// lo dispara Datum mismo (un cron propio, ver sección "Cobros" en
// CLAUDE.md), nunca Wompi solo. recurrent:true activa Credential On File
// para mejorar la tasa de aprobación cuando la tarjeta es Visa/Mastercard
// procesada por RBM — en cualquier otro caso Wompi simplemente lo ignora,
// sin error, así que siempre se manda. Los tokens de aceptación se piden
// de nuevo acá adentro (no los recibe el llamador): no hay nadie frente a
// una pantalla a quien mostrarle un checkbox en un cobro automático, así
// que no tiene sentido pedírselos a quien llama esta función.
//
// OJO: según la documentación real de Wompi, una transacción SIEMPRE nace
// en estado PENDING — el `estado` que devuelve esta función nunca es el
// resultado final (aprobado/declinado), eso solo llega después por el
// webhook (ver verificarFirmaEventoWompi). Quien llame esta función debe
// guardar el `id` devuelto y esperar el webhook, nunca asumir que ya sabe
// si el cobro funcionó.
export async function crearCobroRecurrenteWompi(input: {
  fuentePagoId: number;
  montoEnCentavos: number;
  correoCliente: string;
  referencia: string;
}): Promise<{ id: string; estado: string }> {
  const llavePrivada = variableRequerida("LLAVE_PRIVADA_WOMPI");
  const moneda = "COP";
  const [tokens, signature] = await Promise.all([
    obtenerTokensAceptacionWompi(),
    firmaIntegridadWompi({ referencia: input.referencia, montoEnCentavos: input.montoEnCentavos, moneda }),
  ]);
  const respuesta = await fetch(`${WOMPI_API_BASE}/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${llavePrivada}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount_in_cents: input.montoEnCentavos,
      currency: moneda,
      signature,
      customer_email: input.correoCliente,
      reference: input.referencia,
      payment_source_id: input.fuentePagoId,
      recurrent: true,
      acceptance_token: tokens.acceptanceToken,
      accept_personal_auth: tokens.acceptPersonalAuth,
    }),
  });
  const cuerpo = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(cuerpo.error?.reason ?? "No se pudo crear el cobro.");
  }
  return { id: cuerpo.data.id, estado: cuerpo.data.status };
}

export async function consultarTransaccionWompi(id: string): Promise<{ estado: string }> {
  const llavePrivada = variableRequerida("LLAVE_PRIVADA_WOMPI");
  const respuesta = await fetch(`${WOMPI_API_BASE}/transactions/${id}`, {
    headers: { Authorization: `Bearer ${llavePrivada}` },
  });
  if (!respuesta.ok) throw new Error("No se pudo consultar el estado del cobro.");
  const cuerpo = await respuesta.json();
  return { estado: cuerpo.data.status };
}

function valorEnRuta(objeto: unknown, ruta: string): string {
  let actual: unknown = objeto;
  for (const parte of ruta.split(".")) {
    if (actual == null || typeof actual !== "object") return "";
    actual = (actual as Record<string, unknown>)[parte];
  }
  return actual == null ? "" : String(actual);
}

// Verifica que un aviso que llegó al webhook de verdad venga de Wompi y no
// de alguien suplantándolo (ver CLAUDE.md, sección "Cobros"). "properties"
// nunca se asume fijo: Wompi avisa que esa lista puede cambiar con el
// tiempo, así que siempre se lee del propio evento, nunca se hardcodea.
export async function verificarFirmaEventoWompi(evento: {
  data: unknown;
  timestamp: number;
  signature: { properties: string[]; checksum: string };
}): Promise<boolean> {
  const secreto = variableRequerida("SECRETO_EVENTOS_WOMPI");
  const valores = evento.signature.properties.map((ruta) => valorEnRuta(evento.data, ruta)).join("");
  const checksumCalculado = await sha256Hex(`${valores}${evento.timestamp}${secreto}`);
  return checksumCalculado.toLowerCase() === evento.signature.checksum.toLowerCase();
}
