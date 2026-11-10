import { Resend } from "resend";

const URL_APP = process.env.NEXT_PUBLIC_APP_URL ?? "https://datum.vercel.app";
const REMITENTE = process.env.RESEND_FROM_EMAIL ?? "Datum <onboarding@resend.dev>";

const CIERRE_CALIDO = `
  <p style="font-size: 13px; color: #6b7280;">
    Cualquier cosa que necesites, aquí estamos.<br />— El equipo de Datum
  </p>
`;

function boton(texto: string, href: string) {
  return `
    <p>
      <a href="${href}" style="display: inline-block; background: #111827; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none;">
        ${texto}
      </a>
    </p>
  `;
}

// Envoltorio compartido por todos los correos de Datum: mismo tono, mismo
// tamaño, misma firma al final. Cada correo solo arma su propio título y
// cuerpo; esto evita repetir el marcado alrededor en cada uno.
function plantillaCorreo({ titulo, cuerpo }: { titulo: string; cuerpo: string }) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
      <h1 style="font-size: 18px;">${titulo}</h1>
      ${cuerpo}
      <p style="font-size: 11px; color: #9ca3af; margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
        Datum · Ecosistema de soluciones empresariales
      </p>
    </div>
  `;
}

// Encabezado/tarjeta/pie compartidos por los 3 correos con el diseño nuevo
// (Bienvenida, Aviso fin de prueba, Pago fallido — diseñado con Visual y
// revisado con Copy de Oficina Datum, 2026-11-10; enviarCorreoResumenSemanal
// se queda con plantillaCorreo()/boton() de arriba, sin tocar). El ícono es
// el mismo compás que usa el resto de la app (sidebar.tsx, landing.tsx) en
// SVG inline — Outlook de escritorio no lo soporta, así que los comentarios
// [if mso]/[if !mso] lo reemplazan por el texto "Datum" solo ahí, nunca un
// espacio roto.
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
        Tu prueba gratuita de 15 días en Datum está por terminar — te quedan <span style="display:inline-block; background-color:#e3a748; color:#1a1b33; font-weight:700; padding:2px 10px; border-radius:6px;" bgcolor="#e3a748">${dias}</span>.
        <br /><br />
        Para que <strong>${nombreEmpresa}</strong> siga funcionando sin interrupciones, agrega tu método de pago antes de que termine tu prueba.
      </td>
    </tr>
    ${botonV2("Agregar método de pago", `${URL_APP}/agregar-metodo-pago`)}
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
}: {
  correo: string;
  nombreEmpresa: string;
}): Promise<{ error: string | null }> {
  const filas = `
    <tr>
      <td style="padding:16px 32px 0 32px; font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size:15px; line-height:1.6; color:#14151f;">
        No pudimos cobrar el plan de <strong>${nombreEmpresa}</strong> — tranquilo, tu cuenta sigue activa por ahora.
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

export async function enviarCorreoResumenSemanal({
  correo,
  nombreEmpresa,
  ventasSemana,
  ventasSemanaAnterior,
}: {
  correo: string;
  nombreEmpresa: string;
  ventasSemana: number;
  ventasSemanaAnterior: number;
}): Promise<{ error: string | null }> {
  const formatoCOP = (valor: number) =>
    valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });

  let comparacion: string;
  if (ventasSemanaAnterior > 0) {
    const diferencia = Math.round(((ventasSemana - ventasSemanaAnterior) / ventasSemanaAnterior) * 100);
    if (diferencia > 0) comparacion = `▲ ${diferencia}% más que la semana anterior`;
    else if (diferencia < 0) comparacion = `▼ ${Math.abs(diferencia)}% menos que la semana anterior`;
    else comparacion = "Igual que la semana anterior";
  } else {
    comparacion = "Aún no hay una semana anterior con qué comparar";
  }

  const cuerpo = `
    <p>Aquí tienes un resumen rápido de <strong>${nombreEmpresa}</strong> en los últimos 7 días:</p>
    <table style="margin: 16px 0; font-size: 14px;">
      <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Vendido esta semana</td><td><strong>${formatoCOP(ventasSemana)}</strong></td></tr>
      <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Comparado con la anterior</td><td><strong>${comparacion}</strong></td></tr>
    </table>
    ${boton("Ver Ventas", `${URL_APP}/ventas`)}
    ${CIERRE_CALIDO}
  `;

  return enviar({
    correo,
    asunto: "Tu resumen semanal de Datum",
    html: plantillaCorreo({ titulo: "Así te fue esta semana", cuerpo }),
  });
}
