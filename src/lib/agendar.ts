import { createAdminClient } from "@/lib/supabase/admin";
import { refrescarAccessToken, consultarFreeBusy, crearEventoCalendarConToken } from "@/lib/google";

// Formulario público de agendamiento de la landing (ver CLAUDE.md, sección
// "Formulario de agendamiento"). Sin sesión posible (el visitante no tiene
// cuenta en Datum), así que todo acá usa createAdminClient() para leer el
// Google Calendar conectado por el admin y para escribir el lead resultante
// — con cuidado, es la única parte del proyecto (junto al cron semanal) que
// se salta Row Level Security a propósito. Ver el comentario de
// src/lib/supabase/admin.ts para el porqué.

const DURACION_MINUTOS = 30;
const MESES_ADELANTE = 2;
const HORAS_MINIMO_ANTICIPACION = 2;
const HORA_APERTURA_DEFECTO = 9;
const HORA_CIERRE_DEFECTO = 17;
// Colombia no tiene horario de verano — el desfase con UTC es siempre -5.
const DESFASE_BOGOTA_HORAS = 5;

export type Franja = { inicioISO: string; finISO: string };

type TokenAdmin = { token: string; detalle?: undefined } | { token: null; detalle: string };

// Devuelve también un "detalle" técnico (nunca se le muestra al visitante,
// solo viaja hasta el JSON de /api/agendar/disponibilidad para que, si algo
// falla, se pueda ver la causa real visitando esa dirección directamente en
// el navegador, en vez de quedar a ciegas con un mensaje genérico.
async function obtenerAccessTokenAdmin(): Promise<TokenAdmin> {
  const superAdminId = process.env.SUPER_ADMIN_USER_ID;
  if (!superAdminId) return { token: null, detalle: "Falta configurar la variable SUPER_ADMIN_USER_ID." };

  const supabase = createAdminClient();
  const { data: integracion, error } = await supabase
    .from("integraciones_google")
    .select("refresh_token")
    .eq("perfil_id", superAdminId)
    .maybeSingle();
  if (error) return { token: null, detalle: `No se pudo leer integraciones_google: ${error.message}` };
  if (!integracion) {
    return {
      token: null,
      detalle: `No hay ninguna cuenta de Google conectada para el usuario ${superAdminId}. Conéctala con el botón "Conectar Google Calendar" usando exactamente esa cuenta.`,
    };
  }

  try {
    const token = await refrescarAccessToken(integracion.refresh_token);
    return { token };
  } catch (e) {
    return {
      token: null,
      detalle: `No se pudo renovar el acceso a Google: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

async function obtenerHorarioAtencion(): Promise<{ horaApertura: number; horaCierre: number }> {
  const superAdminId = process.env.SUPER_ADMIN_USER_ID;
  if (!superAdminId) return { horaApertura: HORA_APERTURA_DEFECTO, horaCierre: HORA_CIERRE_DEFECTO };

  const supabase = createAdminClient();
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", superAdminId)
    .maybeSingle();
  if (!perfil?.empresa_id) return { horaApertura: HORA_APERTURA_DEFECTO, horaCierre: HORA_CIERRE_DEFECTO };

  const { data: empresa } = await supabase
    .from("empresas")
    .select("hora_apertura, hora_cierre")
    .eq("id", perfil.empresa_id)
    .maybeSingle();

  if (!empresa?.hora_apertura || !empresa?.hora_cierre) {
    return { horaApertura: HORA_APERTURA_DEFECTO, horaCierre: HORA_CIERRE_DEFECTO };
  }
  return {
    horaApertura: parseInt(String(empresa.hora_apertura).split(":")[0], 10),
    horaCierre: parseInt(String(empresa.hora_cierre).split(":")[0], 10),
  };
}

// year/month/date acá son los del día en Bogotá (no UTC) — construir la
// franja con Date.UTC(..., horaBogota + 5, minuto) da directamente el
// instante UTC real correspondiente a esa hora en Bogotá.
function construirFranja(year: number, month: number, date: number, horaBogota: number, minuto: number): Franja {
  const inicio = new Date(Date.UTC(year, month, date, horaBogota + DESFASE_BOGOTA_HORAS, minuto));
  const fin = new Date(inicio.getTime() + DURACION_MINUTOS * 60 * 1000);
  return { inicioISO: inicio.toISOString(), finISO: fin.toISOString() };
}

function generarFranjasCandidatas(horaApertura: number, horaCierre: number): Franja[] {
  const ahoraUTC = new Date();
  // Desplaza "ahora" 5 horas atrás para poder leer año/mes/día como si
  // fueran los de Bogotá usando los getters de UTC (mismo truco al revés
  // que construirFranja).
  const ahoraBogota = new Date(ahoraUTC.getTime() - DESFASE_BOGOTA_HORAS * 60 * 60 * 1000);
  const minimoInicio = new Date(ahoraUTC.getTime() + HORAS_MINIMO_ANTICIPACION * 60 * 60 * 1000);
  // Ventana fija de 2 meses calendario (no de días hábiles) — así el
  // calendario del widget siempre tiene un segundo mes real para navegar,
  // en vez de quedarse casi siempre en uno solo. Date.UTC ajusta el
  // desborde de mes/año solo (ej. mes 13 pasa a enero del año siguiente).
  const fechaLimite = new Date(
    Date.UTC(ahoraBogota.getUTCFullYear(), ahoraBogota.getUTCMonth() + MESES_ADELANTE, ahoraBogota.getUTCDate()),
  );

  const franjas: Franja[] = [];
  // El límite real es fechaLimite; offsetDias < 120 es solo un tope de
  // seguridad para no iterar para siempre si algo raro pasa con las fechas.
  for (let offsetDias = 0; offsetDias < 120; offsetDias++) {
    const dia = new Date(
      Date.UTC(ahoraBogota.getUTCFullYear(), ahoraBogota.getUTCMonth(), ahoraBogota.getUTCDate() + offsetDias),
    );
    if (dia > fechaLimite) break;
    const diaSemana = dia.getUTCDay(); // 0 domingo, 6 sábado
    if (diaSemana === 0 || diaSemana === 6) continue;

    for (let hora = horaApertura; hora < horaCierre; hora++) {
      for (const minuto of [0, 30]) {
        const franja = construirFranja(dia.getUTCFullYear(), dia.getUTCMonth(), dia.getUTCDate(), hora, minuto);
        if (new Date(franja.inicioISO) >= minimoInicio) franjas.push(franja);
      }
    }
  }
  return franjas;
}

function seCruzan(a: Franja, ocupado: { inicio: string; fin: string }): boolean {
  return new Date(a.inicioISO) < new Date(ocupado.fin) && new Date(a.finISO) > new Date(ocupado.inicio);
}

export async function consultarDisponibilidad(): Promise<
  { franjas: Franja[] } | { error: string; detalle: string }
> {
  const resultadoToken = await obtenerAccessTokenAdmin();
  if (resultadoToken.token === null) {
    return { error: "Por ahora no podemos mostrar horarios disponibles — escríbenos directamente.", detalle: resultadoToken.detalle };
  }

  const { horaApertura, horaCierre } = await obtenerHorarioAtencion();
  const candidatas = generarFranjasCandidatas(horaApertura, horaCierre);
  if (candidatas.length === 0) return { franjas: [] };

  const resultado = await consultarFreeBusy(
    resultadoToken.token,
    candidatas[0].inicioISO,
    candidatas[candidatas.length - 1].finISO,
  );
  if ("error" in resultado) {
    return { error: "Por ahora no podemos mostrar horarios disponibles — escríbenos directamente.", detalle: resultado.error };
  }

  const libres = candidatas.filter((franja) => !resultado.ocupados.some((ocupado) => seCruzan(franja, ocupado)));
  return { franjas: libres };
}

function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

export async function reservarReunion(input: {
  nombre: string;
  correo: string;
  telefono: string;
  empresa: string;
  nota: string;
  horarioISO: string;
  trampa: string;
}): Promise<{ ok: true; link: string | null; meetLink: string | null } | { error: string }> {
  // Campo trampa (honeypot): un visitante real nunca lo llena porque está
  // oculto — si llega con algo, es un bot rellenando el formulario entero.
  if (input.trampa) return { error: "No se pudo agendar la reunión." };

  if (!input.nombre.trim() || !input.correo.trim() || !input.telefono.trim() || !input.empresa.trim()) {
    return { error: "Nombre, correo, teléfono y empresa son obligatorios." };
  }
  if (!correoValido(input.correo)) return { error: "El correo no parece válido." };

  const inicio = new Date(input.horarioISO);
  if (Number.isNaN(inicio.getTime()) || inicio.getTime() < Date.now()) {
    return { error: "Ese horario ya no es válido — elige otro." };
  }
  const fin = new Date(inicio.getTime() + DURACION_MINUTOS * 60 * 1000);
  const franjaElegida: Franja = { inicioISO: inicio.toISOString(), finISO: fin.toISOString() };

  const resultadoToken = await obtenerAccessTokenAdmin();
  if (resultadoToken.token === null) return { error: "Por ahora no podemos agendar reuniones — escríbenos directamente." };
  const accessToken = resultadoToken.token;

  // Se vuelve a consultar justo antes de crear el evento, para no chocar
  // con alguien más reservando la misma franja segundos antes.
  const disponibilidadActual = await consultarFreeBusy(accessToken, franjaElegida.inicioISO, franjaElegida.finISO);
  if ("error" in disponibilidadActual) {
    return { error: "No se pudo confirmar la reunión — intenta de nuevo." };
  }
  if (disponibilidadActual.ocupados.some((ocupado) => seCruzan(franjaElegida, ocupado))) {
    return { error: "Ese horario se acaba de ocupar — elige otro." };
  }

  const superAdminId = process.env.SUPER_ADMIN_USER_ID!;
  const supabase = createAdminClient();

  const descripcionPartes = [input.empresa ? `Empresa: ${input.empresa}` : null, input.nota || null].filter(
    (p): p is string => Boolean(p),
  );

  const evento = await crearEventoCalendarConToken(accessToken, {
    titulo: `Reunión con ${input.nombre} — Datum`,
    descripcion: descripcionPartes.join("\n\n"),
    fechaInicioISO: franjaElegida.inicioISO,
    fechaFinISO: franjaElegida.finISO,
    invitados: [input.correo],
  });
  if ("error" in evento) return { error: "No se pudo crear el evento en el calendario." };

  const { data: lead, error: errorLead } = await supabase
    .from("datum_leads")
    .insert({
      nombre: input.nombre,
      empresa: input.empresa || null,
      telefono: input.telefono,
      email: input.correo,
      notas: input.nota || null,
    })
    .select("id")
    .single();
  if (errorLead || !lead) return { error: "No se pudo guardar tu información." };

  await supabase.from("datum_crm_eventos_calendar").insert({
    lead_id: lead.id,
    perfil_id: superAdminId,
    google_event_id: evento.googleEventId,
    link: evento.link,
    meet_link: evento.meetLink,
    titulo: `Reunión con ${input.nombre} — Datum`,
    fecha: franjaElegida.inicioISO,
  });

  await supabase.from("datum_crm_historial_lead").insert({
    lead_id: lead.id,
    perfil_id: null, // lo agendó el sistema, desde el formulario público — no una persona
    campo: "Reunión agendada",
    valor_anterior: null,
    valor_nuevo: new Intl.DateTimeFormat("es-CO", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "America/Bogota",
    }).format(inicio),
  });

  return { ok: true, link: evento.link, meetLink: evento.meetLink };
}
