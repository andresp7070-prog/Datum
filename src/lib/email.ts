import { Resend } from "resend";

const URL_APP = process.env.NEXT_PUBLIC_APP_URL ?? "https://datum.vercel.app";
const REMITENTE = process.env.RESEND_FROM_EMAIL ?? "Datum <onboarding@resend.dev>";

// TODO: número real de WhatsApp de Datum — pendiente, pedido a Andrés
// 2026-11-11. Mientras tanto este link no funciona; no desplegar a
// producción hasta reemplazarlo.
const WHATSAPP_DATUM = "573000000000";
const URL_AGENDAR = `${URL_APP}/#contacto`;
const URL_WHATSAPP = `https://wa.me/${WHATSAPP_DATUM}`;

// maximumFractionDigits: 0 porque el peso colombiano no se muestra con
// centavos en ningún lado de la app (ver vista_resumen_ventas, etc.) — sin
// esto, toLocaleString agrega ",00" a cada monto.
const formatoCOP = (valor: number) =>
  valor.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

// Encabezado/tarjeta/pie compartidos por todos los correos de Datum
// (diseñado con Visual y revisado con Copy de Oficina Datum, 2026-11-10).
// El ícono es el mismo compás que usa el resto de la app (sidebar.tsx,
// landing.tsx) en SVG inline — Outlook de escritorio no lo soporta, así que
// los comentarios [if mso]/[if !mso] lo reemplazan por el texto "Datum"
// solo ahí, nunca un espacio roto.
function tarjetaCorreoV2({ titulo, filas }: { titulo: string; filas: string }) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f1eb; margin:0; padding:0;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <!--[if mso]>
          <table role="presentation" align="center" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td>
          <![endif]-->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; margin:0 auto; background-color:#ffffff; border:1px solid #e4e1d8; border-radius:14px;">
            <tr>
              <td style="background-color:#1a1b33; border-radius:14px 14px 0 0; height:6px; line-height:6px; font-size:1px;" bgcolor="#1a1b33">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:36px 32px 0 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <!--[if !mso]><!-->
                    <td style="vertical-align:middle;">
                      <svg width="28" height="28" viewBox="0 0 48 48" fill="none" aria-hidden="true" style="display:block;">
                        <path d="M 24 42 A 18 18 0 1 1 36.321 37.122" stroke="#1a1b33" stroke-width="3.6" stroke-linecap="round" />
                        <path d="M24 10 L29 24 L24 38 L19 24 Z" fill="#1a1b33" />
                      </svg>
                    </td>
                    <!--<![endif]-->
                    <!--[if mso]>
                    <td style="vertical-align:middle;">
                      <span style="font-family:Georgia, serif; font-size:19px; font-weight:600; color:#1a1b33; letter-spacing:0.01em;">Datum</span>
                    </td>
                    <![endif]-->
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px 0 32px;">
                <h1 style="margin:0; font-family:'Fraunces', Georgia, serif; font-size:25px; line-height:1.3; font-weight:600; color:#1a1b33;">${titulo}</h1>
              </td>
            </tr>
            ${filas}
            <tr>
              <td style="padding:24px 32px 0 32px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:13px; line-height:1.6; color:#5b5d6e;">
                Cualquier cosa que necesites, aquí estamos.<br />— El equipo de Datum
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 36px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="border-top:1px solid #e4e1d8; padding-top:16px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:11px; color:#9092a3;">
                      Datum · Ecosistema de soluciones empresariales
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <!--[if mso]>
          </td></tr></table>
          <![endif]-->
        </td>
      </tr>
    </table>
  `;
}

function botonV2(texto: string, href: string) {
  return `
    <tr>
      <td style="padding:28px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background-color:#1a1b33; border-radius:8px;" bgcolor="#1a1b33">
              <a href="${href}" style="display:inline-block; padding:13px 28px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none;">${texto}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

// Botón secundario (contorno, sin relleno) — para una segunda acción que no
// debe competir visualmente con el botón principal de botonV2().
function botonSecundarioV2(texto: string, href: string) {
  return `
    <tr>
      <td style="padding:12px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="border:1.5px solid #1a1b33; border-radius:8px;">
              <a href="${href}" style="display:inline-block; padding:11.5px 26px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:15px; font-weight:600; color:#1a1b33; text-decoration:none;">${texto}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

// Fila de texto + los dos botones de contacto (agendar llamada / WhatsApp),
// para repetir exactamente igual en los correos de fin de prueba. Un solo
// lugar para las dos URLs — si cambian, se ajustan una vez.
function filasContacto() {
  return `
    <tr>
      <td style="padding:16px 32px 0 32px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:13px; line-height:1.55; color:#5b5d6e;">
        ¿Prefieres hablar con nosotros antes de decidir?
      </td>
    </tr>
    ${botonSecundarioV2("Agendar una llamada", URL_AGENDAR)}
    ${botonSecundarioV2("Escríbenos por WhatsApp", URL_WHATSAPP)}
  `;
}

async function enviar({
  correo,
  asunto,
  html,
}: {
  correo: string;
  asunto: string;
  html: string;
}): Promise<{ error: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { error: "Falta configurar RESEND_API_KEY en las variables de entorno." };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: REMITENTE,
    to: correo,
    subject: asunto,
    html,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function enviarCorreoBienvenida({
  correo,
  nombreEmpresa,
  contrasena,
}: {
  correo: string;
  nombreEmpresa: string;
  contrasena: string;
}): Promise<{ error: string | null }> {
  const filas = `
    <tr>
      <td style="padding:16px 32px 0 32px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:15px; line-height:1.6; color:#14151f;">
        Ya dejamos todo listo para que <strong>${nombreEmpresa}</strong> empiece a usar Datum. Aquí tienes tus datos para entrar cuando quieras:
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f6f0; border-left:4px solid #e3a748; border-radius:0 8px 8px 0;" bgcolor="#f8f6f0">
          <tr>
            <td style="padding:16px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:14px; color:#14151f;">
                <tr>
                  <td style="padding:4px 0; color:#5b5d6e; width:44%;">Correo</td>
                  <td style="padding:4px 0; font-weight:700;">${correo}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; color:#5b5d6e; width:44%;">Contraseña temporal</td>
                  <td style="padding:4px 0; font-weight:700;">${contrasena}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${botonV2("Entrar a Datum", `${URL_APP}/login`)}
    <tr>
      <td style="padding:20px 32px 0 32px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:13px; line-height:1.6; color:#5b5d6e;">
        Ah, una cosita: la primera vez que entres te vamos a pedir que cambies esta contraseña por una tuya, así el acceso queda solo para ti.
      </td>
    </tr>
  `;

  return enviar({
    correo,
    asunto: "Bienvenido a Datum",
    html: tarjetaCorreoV2({ titulo: "Bienvenido a Datum", filas }),
  });
}

export async function enviarCorreoFinDePrueba({
  correo,
  nombreEmpresa,
  diasRestantes,
}: {
  correo: string;
  nombreEmpresa: string;
  diasRestantes: number;
}): Promise<{ error: string | null }> {
  const dias = diasRestantes === 1 ? "1 día" : `${diasRestantes} días`;
  const filas = `
    <tr>
      <td style="padding:16px 32px 0 32px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:15px; line-height:1.7; color:#14151f;">
        Te quedan <span style="display:inline-block; background-color:#e3a748; color:#1a1b33; font-weight:700; padding:2px 10px; border-radius:6px;" bgcolor="#e3a748">${dias}</span> de tu prueba gratuita de 15 días en Datum.
        <br /><br />
        Para que <strong>${nombreEmpresa}</strong> siga funcionando sin interrupciones, agrega tu método de pago antes de que termine tu prueba.
      </td>
    </tr>
    ${botonV2("Agregar método de pago", `${URL_APP}/agregar-metodo-pago`)}
    ${filasContacto()}
  `;

  return enviar({
    correo,
    asunto: "Tu prueba de Datum termina pronto",
    html: tarjetaCorreoV2({ titulo: "Tu prueba está por terminar", filas }),
  });
}

export async function enviarCorreoPagoFallido({
  correo,
  nombreEmpresa,
  monto,
}: {
  correo: string;
  nombreEmpresa: string;
  monto: number;
}): Promise<{ error: string | null }> {
  const filas = `
    <tr>
      <td style="padding:16px 32px 0 32px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:15px; line-height:1.6; color:#14151f;">
        No fue posible realizar el cobro por <strong>${formatoCOP(monto)}</strong> del plan de <strong>${nombreEmpresa}</strong>.
      </td>
    </tr>
    <tr>
      <td style="padding:18px 32px 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f6f0; border-left:4px solid #e3a748; border-radius:0 8px 8px 0;" bgcolor="#f8f6f0">
          <tr>
            <td style="padding:14px 20px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:14px; line-height:1.5; color:#1a1b33; font-weight:600;">
              Cuando puedas, actualiza tu método de pago y volvemos a intentar el cobro.
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${botonV2("Agregar método de pago", `${URL_APP}/agregar-metodo-pago`)}
  `;

  return enviar({
    correo,
    asunto: "No pudimos procesar el pago de Datum",
    html: tarjetaCorreoV2({ titulo: "No pudimos procesar tu pago", filas }),
  });
}

// Los siguientes 8 correos se diseñaron con Visual y Copy de Oficina Datum
// (2026-11-10), con el mismo tarjetaCorreoV2()/botonV2() de arriba — pero
// ninguno está conectado todavía a su disparador real (cron, webhook, ruta).
// Ver CLAUDE.md, "Cadencia de los correos automáticos".

export async function enviarCorreoReunionAgendada({
  correo,
  nombre,
  empresa,
  fechaHoraISO,
  meetLink,
  modulosInteres,
}: {
  correo: string;
  nombre: string;
  empresa: string;
  fechaHoraISO: string;
  meetLink: string | null;
  modulosInteres?: string[];
}): Promise<{ error: string | null }> {
  const fechaHoraTexto = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date(fechaHoraISO));

  const filas = `
    <tr>
      <td style="padding:16px 32px 0 32px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:15px; line-height:1.6; color:#14151f;">
        Hola ${nombre}, gracias por tomarte un espacio para hablar de Datum con <strong>${empresa}</strong>. Quedamos así:
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f6f0; border-left:4px solid #e3a748; border-radius:0 8px 8px 0;" bgcolor="#f8f6f0">
          <tr>
            <td style="padding:16px 20px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:14px; color:#14151f;">
              <span style="color:#5b5d6e;">Tu reunión</span><br />
              <strong style="font-size:15px;">${fechaHoraTexto} (hora Colombia)</strong>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 32px 0 32px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:14px; line-height:1.6; color:#5b5d6e;">
        Google Calendar ya te mandó la invitación a tu correo con todos los detalles — este mensaje es solo nuestra forma de confirmarte que quedó todo listo.${
          modulosInteres && modulosInteres.length > 0
            ? ` Vamos a conversar especialmente de: <strong style="color:#14151f;">${modulosInteres.join(", ")}</strong>.`
            : ""
        }
      </td>
    </tr>
    ${meetLink ? botonV2("Unirme a la reunión", meetLink) : ""}
  `;

  return enviar({
    correo,
    asunto: "Quedamos agendados — tu reunión con Datum",
    html: tarjetaCorreoV2({ titulo: "¡Quedamos agendados!", filas }),
  });
}

export async function enviarCorreoPruebaActivada({
  correo,
  nombreEmpresa,
  fechaInicio,
  fechaFin,
  modulos,
}: {
  correo: string;
  nombreEmpresa: string;
  fechaInicio: Date;
  fechaFin: Date;
  modulos: string[]; // nombres ya humanizados, ej. ["Ventas", "Inventario"]
}): Promise<{ error: string | null }> {
  const formatoFecha = (fecha: Date) =>
    new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(fecha);

  const filas = `
    <tr>
      <td style="padding:16px 32px 0 32px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:15px; line-height:1.6; color:#14151f;">
        Desde hoy, <strong>${nombreEmpresa}</strong> tiene acceso completo a Datum sin costo durante 15 días.
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f6f0; border-left:4px solid #e3a748; border-radius:0 8px 8px 0;" bgcolor="#f8f6f0">
          <tr>
            <td style="padding:16px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:14px; color:#14151f;">
                <tr>
                  <td style="padding:4px 0; color:#5b5d6e; width:44%;">Empieza</td>
                  <td style="padding:4px 0; font-weight:700;">${formatoFecha(fechaInicio)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; color:#5b5d6e; width:44%;">Termina</td>
                  <td style="padding:4px 0; font-weight:700;">${formatoFecha(fechaFin)}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 32px 0 32px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:14px; line-height:1.6; color:#5b5d6e;">
        Quedaron activos los módulos que elegiste: <strong style="color:#14151f;">${modulos.join(", ")}</strong>. El Panel de control viene incluido sin costo en cualquier plan, así que ya lo tienes disponible también.
      </td>
    </tr>
    ${botonV2("Entrar a Datum", `${URL_APP}/login`)}
  `;

  return enviar({
    correo,
    asunto: "Tu prueba gratuita de Datum ya está activa",
    html: tarjetaCorreoV2({ titulo: "Tu prueba de 15 días ya empezó", filas }),
  });
}

export async function enviarCorreoContrasenaActualizada({
  correo,
  nombreEmpresa,
}: {
  correo: string;
  nombreEmpresa: string;
}): Promise<{ error: string | null }> {
  const fechaHoraTexto = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date());

  const filas = `
    <tr>
      <td style="padding:16px 32px 0 32px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:15px; line-height:1.6; color:#14151f;">
        La contraseña de la cuenta de <strong>${nombreEmpresa}</strong> en Datum se actualizó correctamente, el ${fechaHoraTexto} (hora Colombia).
      </td>
    </tr>
    <tr>
      <td style="padding:16px 32px 0 32px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:13px; line-height:1.6; color:#5b5d6e;">
        Si no fuiste tú quien hizo este cambio, <a href="mailto:andresp7070@gmail.com" style="color:#1a1b33; font-weight:600; text-decoration:underline;">contáctanos de inmediato</a> — te ayudamos a revisar tu cuenta cuanto antes.
      </td>
    </tr>
  `;

  return enviar({
    correo,
    asunto: "Tu contraseña de Datum se actualizó",
    html: tarjetaCorreoV2({ titulo: "Contraseña actualizada", filas }),
  });
}

export async function enviarCorreoPruebaVencida({
  correo,
  nombreEmpresa,
}: {
  correo: string;
  nombreEmpresa: string;
}): Promise<{ error: string | null }> {
  const filas = `
    <tr>
      <td style="padding:16px 32px 0 32px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:15px; line-height:1.6; color:#14151f;">
        Hoy se cumplieron los 15 días de prueba gratuita de <strong>${nombreEmpresa}</strong> en Datum.
        <br /><br />
        Para seguir disfrutando de Datum sin interrupciones, recuerda agregar tu método de pago.
      </td>
    </tr>
    ${botonV2("Agregar método de pago", `${URL_APP}/agregar-metodo-pago`)}
    ${filasContacto()}
  `;

  return enviar({
    correo,
    asunto: "Tu prueba gratuita de Datum se cumplió",
    html: tarjetaCorreoV2({ titulo: "Tu prueba está por terminar", filas }),
  });
}

export async function enviarCorreoMetodoPagoAgregado({
  correo,
  nombreEmpresa,
  descripcionMetodo,
}: {
  correo: string;
  nombreEmpresa: string;
  descripcionMetodo: string; // ej. "Visa •••• 4242" o "Bancolombia"
}): Promise<{ error: string | null }> {
  const filas = `
    <tr>
      <td style="padding:16px 32px 0 32px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:15px; line-height:1.6; color:#14151f;">
        Guardamos un nuevo método de pago para <strong>${nombreEmpresa}</strong>:
      </td>
    </tr>
    <tr>
      <td style="padding:16px 32px 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f6f0; border-left:4px solid #e3a748; border-radius:0 8px 8px 0;" bgcolor="#f8f6f0">
          <tr>
            <td style="padding:14px 20px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:15px; font-weight:700; color:#14151f;">
              ${descripcionMetodo}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 32px 0 32px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:13px; line-height:1.6; color:#5b5d6e;">
        Por tu seguridad, el número completo nunca se guarda en los servidores de Datum — vive directamente en la pasarela de pago que procesa el cobro.
      </td>
    </tr>
    ${botonV2("Ver métodos de pago", `${URL_APP}/metodos-pago`)}
  `;

  return enviar({
    correo,
    asunto: "Guardamos tu método de pago en Datum",
    html: tarjetaCorreoV2({ titulo: "Método de pago guardado", filas }),
  });
}

export async function enviarCorreoPagoRealizado({
  correo,
  nombreEmpresa,
  monto,
  plan,
  descripcionMetodo,
}: {
  correo: string;
  nombreEmpresa: string;
  monto: number;
  plan: string; // nombre ya humanizado, ej. "Startup"
  descripcionMetodo: string; // ej. "Visa •••• 4242" o "Bancolombia"
}): Promise<{ error: string | null }> {
  const filas = `
    <tr>
      <td style="padding:16px 32px 0 32px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:15px; line-height:1.6; color:#14151f;">
        Recibimos el pago de <strong>${nombreEmpresa}</strong>.
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f6f0; border-left:4px solid #e3a748; border-radius:0 8px 8px 0;" bgcolor="#f8f6f0">
          <tr>
            <td style="padding:16px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:14px; color:#14151f;">
                <tr>
                  <td style="padding:4px 0; color:#5b5d6e; width:44%;">Monto cobrado</td>
                  <td style="padding:4px 0; font-weight:700;">${formatoCOP(monto)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; color:#5b5d6e; width:44%;">Plan</td>
                  <td style="padding:4px 0; font-weight:700;">${plan}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; color:#5b5d6e; width:44%;">Método de pago</td>
                  <td style="padding:4px 0; font-weight:700;">${descripcionMetodo}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${botonV2("Ver mi cuenta", `${URL_APP}/cuenta`)}
  `;

  return enviar({
    correo,
    asunto: "Confirmamos tu pago de Datum",
    html: tarjetaCorreoV2({ titulo: "¡Pago confirmado!", filas }),
  });
}

// Variante de enviarCorreoPagoRealizado para cuando un cobro de Wompi suma
// más de un concepto (suscripción + facturación electrónica por uso y/o
// desarrollo a la medida) — hoy ningún mecanismo real junta esos cobros en
// una sola transacción (ver CLAUDE.md, "Cobro variable por uso" y "Planes y
// precios": ninguno de los dos está construido), así que `items` queda
// genérico a propósito, listo para cuando exista.
export async function enviarCorreoPagoRealizadoDesglosado({
  correo,
  nombreEmpresa,
  items,
  descripcionMetodo,
}: {
  correo: string;
  nombreEmpresa: string;
  items: { descripcion: string; monto: number }[]; // ej. [{ descripcion: "Suscripción — Plan Startup", monto: 409000 }, { descripcion: "Facturación electrónica (42 facturas)", monto: 18900 }]
  descripcionMetodo: string; // ej. "Visa •••• 4242" o "Bancolombia"
}): Promise<{ error: string | null }> {
  const montoTotal = items.reduce((suma, item) => suma + item.monto, 0);

  const filasItems = items
    .map(
      (item) => `
        <tr>
          <td style="padding:4px 0; color:#5b5d6e; width:44%;">${item.descripcion}</td>
          <td style="padding:4px 0; font-weight:700;">${formatoCOP(item.monto)}</td>
        </tr>`,
    )
    .join("");

  const filas = `
    <tr>
      <td style="padding:16px 32px 0 32px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:15px; line-height:1.6; color:#14151f;">
        Recibimos el pago de <strong>${nombreEmpresa}</strong> — este mes incluye más de un concepto, aquí el detalle:
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f6f0; border-left:4px solid #e3a748; border-radius:0 8px 8px 0;" bgcolor="#f8f6f0">
          <tr>
            <td style="padding:16px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:14px; color:#14151f;">
                ${filasItems}
                <tr>
                  <td style="padding:10px 0 4px; border-top:1px solid #e4e1d8; color:#1a1b33; font-weight:700; width:44%;">Total pagado</td>
                  <td style="padding:10px 0 4px; border-top:1px solid #e4e1d8; font-weight:700;">${formatoCOP(montoTotal)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; color:#5b5d6e; width:44%;">Método de pago</td>
                  <td style="padding:4px 0; font-weight:700;">${descripcionMetodo}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${botonV2("Ver mi cuenta", `${URL_APP}/cuenta`)}
  `;

  return enviar({
    correo,
    asunto: "Confirmamos tu pago de Datum",
    html: tarjetaCorreoV2({ titulo: "¡Pago confirmado!", filas }),
  });
}

export async function enviarCorreoCambioPlan({
  correo,
  nombreEmpresa,
  plan,
  montoMensual,
}: {
  correo: string;
  nombreEmpresa: string;
  plan: string; // nombre ya humanizado, ej. "Pyme"
  montoMensual: number;
}): Promise<{ error: string | null }> {
  const filas = `
    <tr>
      <td style="padding:16px 32px 0 32px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:15px; line-height:1.6; color:#14151f;">
        El plan de <strong>${nombreEmpresa}</strong> en Datum cambió a <strong>${plan}</strong> — ${formatoCOP(montoMensual)}/mes.
      </td>
    </tr>
    <tr>
      <td style="padding:18px 32px 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f6f0; border-left:4px solid #e3a748; border-radius:0 8px 8px 0;" bgcolor="#f8f6f0">
          <tr>
            <td style="padding:14px 20px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:14px; line-height:1.5; color:#1a1b33; font-weight:600;">
              Este nuevo monto se cobra a partir de tu próximo cobro programado. No se cobra ninguna diferencia ahora, ni se prorratea el mes en curso.
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${botonV2("Ver mi cuenta", `${URL_APP}/cuenta`)}
  `;

  return enviar({
    correo,
    asunto: "Tu plan de Datum cambió",
    html: tarjetaCorreoV2({ titulo: "Tu plan cambió", filas }),
  });
}

