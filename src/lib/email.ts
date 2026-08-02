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
  const cuerpo = `
    <p>Ya dejamos todo listo para que <strong>${nombreEmpresa}</strong> empiece a usar Datum. Aquí tienes tus datos para entrar cuando quieras:</p>
    <table style="margin: 16px 0; font-size: 14px;">
      <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Correo</td><td><strong>${correo}</strong></td></tr>
      <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Contraseña temporal</td><td><strong>${contrasena}</strong></td></tr>
    </table>
    ${boton("Entrar a Datum", `${URL_APP}/login`)}
    <p style="font-size: 13px; color: #6b7280;">
      Ah, una cosita: la primera vez que entres te vamos a pedir que cambies esta contraseña por una tuya, así el acceso queda solo para ti.
    </p>
    ${CIERRE_CALIDO}
  `;

  return enviar({
    correo,
    asunto: "Bienvenido a Datum",
    html: plantillaCorreo({ titulo: "Bienvenido a Datum", cuerpo }),
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
  const cuerpo = `
    <p>Te quedan <strong>${dias}</strong> de tu mes de prueba en Datum. Cuando se cumplan, para que <strong>${nombreEmpresa}</strong> siga funcionando sin interrupciones, nos vamos a poner en contacto contigo para coordinar el pago de tu plan.</p>
    ${boton("Ir a Mi cuenta", `${URL_APP}/cuenta`)}
    <p style="font-size: 13px; color: #6b7280;">
      Si tienes alguna duda antes de esa fecha, aquí estamos.
    </p>
    ${CIERRE_CALIDO}
  `;

  return enviar({
    correo,
    asunto: "Tu prueba de Datum termina pronto",
    html: plantillaCorreo({ titulo: "Tu prueba está por terminar", cuerpo }),
  });
}

export async function enviarCorreoPagoFallido({
  correo,
  nombreEmpresa,
}: {
  correo: string;
  nombreEmpresa: string;
}): Promise<{ error: string | null }> {
  const cuerpo = `
    <p>Intentamos cobrar el plan de <strong>${nombreEmpresa}</strong> y no lo logramos. Puede ser algo tan simple como fondos insuficientes o una tarjeta vencida — tranquilo, tu cuenta sigue activa por ahora.</p>
    <p>Actualiza tu método de pago para que todo siga funcionando sin cortes.</p>
    ${boton("Ir a Mi cuenta", `${URL_APP}/cuenta`)}
    ${CIERRE_CALIDO}
  `;

  return enviar({
    correo,
    asunto: "No pudimos procesar el pago de Datum",
    html: plantillaCorreo({ titulo: "No pudimos procesar tu pago", cuerpo }),
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
