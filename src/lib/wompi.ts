// Integración con Wompi (cobro automático de suscripciones) — ver
// CLAUDE.md, sección "Cobros". Código propio contra la API REST de Wompi
// (fetch directo, sin SDK), mismo criterio que src/lib/google.ts.
//
// Wompi usa un HOST distinto por ambiente, no solo un prefijo de llave
// distinto como se pensó al principio — corregido 2026-10-28 al probar en
// sandbox y ver un ejemplo real de su documentación con el host de
// producción. baseUrlWompi() lo decide solo mirando el prefijo de la
// llave que se esté usando en cada llamada, así el ambiente se sigue
// decidiendo solo poniendo un juego de llaves u otro en Vercel, nunca acá.
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

function baseUrlWompi(llave: string): string {
  return llave.startsWith("pub_test_") || llave.startsWith("prv_test_")
    ? "https://sandbox.wompi.co/v1"
    : "https://production.wompi.co/v1";
}

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
  const respuesta = await fetch(`${baseUrlWompi(llavePublica)}/merchants/info`, {
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
// Confirmado 2026-10-29 revisando una respuesta real de Wompi en sandbox:
// POST /payment_sources no entrega la marca de la tarjeta (Visa/Mastercard/
// etc.) como campo propio, pero sí el BIN (los primeros 6 dígitos, en
// data.public_data.bin). La marca se deduce del BIN acá mismo — es un
// estándar de toda la industria (ISO/IEC 7812), no algo específico de
// Wompi, así que no hace falta que su documentación lo confirme para
// usarlo con confianza. Si el BIN no cae en ningún rango reconocido,
// queda sin marca (null) en vez de arriesgar un dato incorrecto.
function marcaDesdeBin(bin: string): string | null {
  if (bin.startsWith("4")) return "Visa";
  const dosDigitos = Number(bin.slice(0, 2));
  const cuatroDigitos = Number(bin.slice(0, 4));
  if (dosDigitos >= 51 && dosDigitos <= 55) return "Mastercard";
  if (cuatroDigitos >= 2221 && cuatroDigitos <= 2720) return "Mastercard";
  if (dosDigitos === 34 || dosDigitos === 37) return "American Express";
  if (dosDigitos === 36 || dosDigitos === 38) return "Diners Club";
  return null;
}

export async function crearFuentePagoWompi(input: {
  tipo: "CARD" | "BANCOLOMBIA_TRANSFER";
  token: string;
  correoCliente: string;
  acceptanceToken: string;
  acceptPersonalAuth: string;
  sessionId?: string;
  deviceId?: string;
  // Solo Bancolombia la pide — la descripción por defecto de los cobros
  // futuros contra esta fuente de pago (confirmado en la documentación de
  // Wompi, sección "Payment Sources & Tokenization").
  descripcionPago?: string;
}): Promise<{
  id: number;
  estado: string;
  marca: string | null;
  ultimosDigitos: string | null;
  titular: string | null;
}> {
  const llavePrivada = variableRequerida("LLAVE_PRIVADA_WOMPI");
  const respuesta = await fetch(`${baseUrlWompi(llavePrivada)}/payment_sources`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${llavePrivada}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: input.tipo,
      token: input.token,
      customer_email: input.correoCliente,
      acceptance_token: input.acceptanceToken,
      accept_personal_auth: input.acceptPersonalAuth,
      ...(input.tipo === "BANCOLOMBIA_TRANSFER"
        ? { payment_description: input.descripcionPago ?? "Suscripción Datum" }
        : {}),
      ...(input.sessionId ? { session_id: input.sessionId } : {}),
      ...(input.deviceId ? { customer_data: { device_id: input.deviceId } } : {}),
    }),
  });
  const cuerpo = await respuesta.json();
  if (!respuesta.ok || cuerpo.data?.status !== "AVAILABLE") {
    throw new Error(cuerpo.error?.reason ?? "No se pudo guardar el método de pago.");
  }

  if (input.tipo === "BANCOLOMBIA_TRANSFER") {
    // Confirmado en la documentación de Wompi: viene como "***1234" — se
    // deja solo los dígitos. Bancolombia no entrega ningún nombre de
    // titular acá (solo tipo de cuenta y últimos 4) — titular queda null
    // a propósito, no es un dato que falte extraer.
    const crudos: string | undefined = cuerpo.data?.public_data?.bank_account_last_four;
    return {
      id: cuerpo.data.id,
      estado: cuerpo.data.status,
      marca: "Bancolombia",
      ultimosDigitos: crudos ? crudos.replace(/\D/g, "") || null : null,
      titular: null,
    };
  }

  const bin: string | undefined = cuerpo.data?.public_data?.bin;
  return {
    id: cuerpo.data.id,
    estado: cuerpo.data.status,
    marca: bin ? marcaDesdeBin(bin) : null,
    ultimosDigitos: cuerpo.data?.public_data?.last_four ?? null,
    titular: cuerpo.data?.public_data?.card_holder ?? null,
  };
}

// Paso 1 del Botón Bancolombia (ver CLAUDE.md, sección "Cobros"): pide un
// "token" de cuenta Bancolombia con type_auth "TOKEN" — eso autoriza la
// cuenta ANTES de cualquier cobro, a diferencia de "TRANSACTION" (que la
// autoriza junto con un primer pago); acá no hay ningún cobro que hacer
// todavía, solo guardar el método. Devuelve una URL a la que hay que
// mandar el navegador completo del cliente (nunca un iframe ni un fetch)
// para que inicie sesión en Bancolombia y autorice — Wompi lo redirige de
// vuelta a redirectUrl cuando termina (aprobado o no).
export async function crearTokenBancolombia(redirectUrl: string): Promise<{
  id: string;
  authorizationUrl: string;
}> {
  const llavePublica = variableRequerida("LLAVE_PUBLICA_WOMPI");
  const respuesta = await fetch(`${baseUrlWompi(llavePublica)}/tokens/bancolombia_transfer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${llavePublica}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ redirect_url: redirectUrl, type_auth: "TOKEN" }),
  });
  const cuerpo = await respuesta.json();
  if (!respuesta.ok || !cuerpo.data?.authorization_url) {
    throw new Error(cuerpo.error?.reason ?? "No se pudo iniciar la conexión con Bancolombia.");
  }
  return { id: cuerpo.data.id, authorizationUrl: cuerpo.data.authorization_url };
}

// Paso siguiente, cuando el cliente ya vuelve de autorizar en Bancolombia
// (ver /api/wompi/bancolombia-callback): confirma que de verdad quedó
// aprobado antes de crear la fuente de pago — nunca se asume por el solo
// hecho de que Wompi lo haya redirigido de vuelta a la aplicación.
export async function consultarTokenBancolombia(tokenId: string): Promise<{ estado: string }> {
  const llavePublica = variableRequerida("LLAVE_PUBLICA_WOMPI");
  const respuesta = await fetch(
    `${baseUrlWompi(llavePublica)}/tokens/bancolombia_transfer/${tokenId}`,
    { headers: { Authorization: `Bearer ${llavePublica}` } },
  );
  const cuerpo = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(cuerpo.error?.reason ?? "No se pudo consultar el estado de Bancolombia.");
  }
  return { estado: cuerpo.data?.status };
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
// CLAUDE.md), nunca Wompi solo. Los tokens de aceptación se piden de
// nuevo acá adentro (no los recibe el llamador): no hay nadie frente a
// una pantalla a quien mostrarle un checkbox en un cobro automático, así
// que no tiene sentido pedírselos a quien llama esta función.
//
// payment_method sí es obligatorio incluso cobrando contra una fuente de
// pago ya existente — confirmado 2026-10-28 contra la página real de
// "Métodos de pago" de Wompi (su propio ejemplo de cobro recurrente con
// Bancolombia manda payment_method + payment_source_id juntos, nunca uno
// sin el otro). Antes esta función no lo mandaba para nada, y en cambio
// mandaba un campo "recurrent: true" que no existe en ninguna parte de
// esa documentación — era una suposición sin confirmar, se quitó.
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
  tipo: "tarjeta" | "bancolombia";
  descripcionPago?: string;
}): Promise<{ id: string; estado: string }> {
  const llavePrivada = variableRequerida("LLAVE_PRIVADA_WOMPI");
  const moneda = "COP";
  const [tokens, signature] = await Promise.all([
    obtenerTokensAceptacionWompi(),
    firmaIntegridadWompi({ referencia: input.referencia, montoEnCentavos: input.montoEnCentavos, moneda }),
  ]);

  // payment_method lleva lo propio de cada cobro: cuotas en tarjeta,
  // descripción en Bancolombia (confirmado en la documentación de Wompi,
  // sección "Payment Sources & Tokenization" — ahí mismo aclaran que para
  // métodos sin nada que configurar, como Nequi, este campo se puede
  // omitir del todo; no aplica todavía porque Nequi no está construido).
  const paymentMethod =
    input.tipo === "bancolombia"
      ? {
          type: "BANCOLOMBIA_TRANSFER",
          payment_description: input.descripcionPago ?? "Suscripción Datum",
        }
      : { type: "CARD", installments: 1 };

  const respuesta = await fetch(`${baseUrlWompi(llavePrivada)}/transactions`, {
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
      payment_method: paymentMethod,
      payment_source_id: input.fuentePagoId,
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
  const respuesta = await fetch(`${baseUrlWompi(llavePrivada)}/transactions/${id}`, {
    headers: { Authorization: `Bearer ${llavePrivada}` },
  });
  if (!respuesta.ok) throw new Error("No se pudo consultar el estado del cobro.");
  const cuerpo = await respuesta.json();
  return { estado: cuerpo.data.status };
}

// Tarifa cotizada del Plan Avanzado de Wompi (ver CLAUDE.md, sección
// "Cobros") — 2,65% + $700 por transacción exitosa con tarjeta, y el IVA
// (19%) se aplica sobre esa comisión completa, no solo sobre los $700.
// Reconstruida comparando esta fórmula contra la tabla "Recibes con Wompi"
// que ya estaba en CLAUDE.md y dando exacto, pero Wompi no entrega este
// desglose en la respuesta de cada transacción — es un cálculo propio, no
// un dato oficial de Wompi. PENDIENTE: Andrés va a confirmar la cifra
// exacta — si cambia, solo hay que ajustar las dos constantes de acá
// abajo, nada más en el proyecto depende de este número.
const COMISION_WOMPI_PORCENTAJE = 0.0265;
const COMISION_WOMPI_FIJA_COP = 700;
const IVA = 0.19;

export function calcularComisionWompi(montoEnPesos: number): { comision: number; neto: number } {
  const comisionSinIva = montoEnPesos * COMISION_WOMPI_PORCENTAJE + COMISION_WOMPI_FIJA_COP;
  const comision = Math.round(comisionSinIva * (1 + IVA));
  return { comision, neto: montoEnPesos - comision };
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
