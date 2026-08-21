import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";

// Integración con Google Calendar — ver CLAUDE.md, sección "Agendar
// seguimiento (Google Calendar)". Código propio contra la API REST de
// Google (sin el paquete googleapis, para no sumar una dependencia pesada
// a un proyecto que hasta ahora no la necesitaba). El access_token nunca
// se guarda: se pide uno nuevo con el refresh_token cada vez que hace
// falta, así no hay que manejar su expiración en ningún lado.

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  // calendar.events solo alcanza para crear/borrar eventos — freeBusy.query
  // (que usa el formulario público de agendamiento para saber qué horarios
  // ofrecer, ver src/lib/agendar.ts) necesita este permiso aparte. Cualquier
  // cuenta conectada ANTES de este cambio necesita reconectarse una vez más
  // para que Google le otorgue este permiso nuevo.
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export function urlBaseApp(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://datum.vercel.app";
}

export function urlRedirectGoogle(): string {
  return `${urlBaseApp()}/api/auth/google/callback`;
}

export function urlAutorizacionGoogle(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: urlRedirectGoogle(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    // Sin esto, Google solo manda refresh_token la primerísima vez que la
    // persona autoriza la app en toda su vida — si alguna vez se desconecta
    // y vuelve a conectar, "consent" fuerza que se lo vuelva a dar.
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function intercambiarCodigoPorTokens(
  code: string,
): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: urlRedirectGoogle(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`No se pudo conectar con Google: ${await res.text()}`);
  return res.json();
}

export async function obtenerCorreoGoogle(accessToken: string): Promise<string | null> {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.email ?? null;
}

export async function refrescarAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`No se pudo renovar el acceso a Google Calendar: ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

async function accessTokenDePerfil(perfilId: string): Promise<string | { error: string }> {
  const supabase = await createClient();
  const { data: integracion } = await supabase
    .from("integraciones_google")
    .select("refresh_token")
    .eq("perfil_id", perfilId)
    .maybeSingle();

  if (!integracion) return { error: "No has conectado tu cuenta de Google Calendar todavía." };

  try {
    return await refrescarAccessToken(integracion.refresh_token);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error desconocido al conectar con Google." };
  }
}

type ResultadoEvento =
  | { googleEventId: string; link: string | null; meetLink: string | null }
  | { error: string };

// Lógica real de creación, ya con un access_token en mano — la usan tanto
// crearEventoCalendar() (busca el token vía la sesión de quien lo llama,
// para "Agendar seguimiento" dentro de la app) como el formulario público
// de agendamiento de la landing (sin sesión: consigue el token aparte, ver
// src/lib/agendar.ts, porque el visitante no tiene con qué autenticarse).
export async function crearEventoCalendarConToken(
  accessToken: string,
  input: { titulo: string; descripcion: string; fechaInicioISO: string; fechaFinISO: string; invitados: string[] },
): Promise<ResultadoEvento> {
  try {
    // conferenceDataVersion=1 le pide a Google que cree el link de Meet;
    // sendUpdates=all manda el correo de invitación a cada invitado.
    const url = `${CALENDAR_EVENTS_URL}?conferenceDataVersion=1&sendUpdates=all`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: input.titulo,
        description: input.descripcion,
        start: { dateTime: input.fechaInicioISO },
        end: { dateTime: input.fechaFinISO },
        attendees: input.invitados.map((email) => ({ email })),
        conferenceData: { createRequest: { requestId: randomUUID() } },
      }),
    });
    if (!res.ok) return { error: `Google rechazó el evento: ${await res.text()}` };
    const data = await res.json();
    return {
      googleEventId: data.id as string,
      link: (data.htmlLink as string | undefined) ?? null,
      meetLink: (data.hangoutLink as string | undefined) ?? null,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error desconocido al crear el evento." };
  }
}

export async function crearEventoCalendar(input: {
  perfilId: string;
  titulo: string;
  descripcion: string;
  fechaInicioISO: string;
  fechaFinISO: string;
  invitados: string[];
}): Promise<ResultadoEvento> {
  const accessToken = await accessTokenDePerfil(input.perfilId);
  if (typeof accessToken !== "string") return accessToken;
  return crearEventoCalendarConToken(accessToken, input);
}

// Períodos ocupados del calendario "primary" de quien sea dueño del
// access_token, en el rango dado — usado por el formulario público de
// agendamiento para calcular qué horarios ofrecer (ver src/lib/agendar.ts).
export async function consultarFreeBusy(
  accessToken: string,
  timeMinISO: string,
  timeMaxISO: string,
): Promise<{ ocupados: { inicio: string; fin: string }[] } | { error: string }> {
  try {
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ timeMin: timeMinISO, timeMax: timeMaxISO, items: [{ id: "primary" }] }),
    });
    if (!res.ok) return { error: `Google rechazó la consulta de disponibilidad: ${await res.text()}` };
    const data = await res.json();
    const busy = data.calendars?.primary?.busy ?? [];
    return { ocupados: busy.map((b: { start: string; end: string }) => ({ inicio: b.start, fin: b.end })) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error desconocido al consultar disponibilidad." };
  }
}

export async function eliminarEventoCalendar(
  perfilId: string,
  googleEventId: string,
): Promise<{ error: string | null }> {
  const accessToken = await accessTokenDePerfil(perfilId);
  // Si ya no hay conexión activa, no hay nada que borrar del lado de
  // Google — se deja borrar igual el registro local que llamó a esto.
  if (typeof accessToken !== "string") return { error: null };

  try {
    const res = await fetch(`${CALENDAR_EVENTS_URL}/${googleEventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok && res.status !== 410 && res.status !== 404) {
      return { error: `Google rechazó el borrado: ${await res.text()}` };
    }
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error desconocido al borrar el evento." };
  }
}
