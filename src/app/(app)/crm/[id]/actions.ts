"use server";

import { createClient } from "@/lib/supabase/server";
import { crearEventoCalendar, eliminarEventoCalendar } from "@/lib/google";
import { formatearValorHistorial } from "@/lib/historial";

export async function cambiarEtapa(
  contactoId: string,
  etapaId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: contactoActual } = await supabase
    .from("crm_contactos")
    .select("etapa_id, empresas ( crm_modo )")
    .eq("id", contactoId)
    .single();

  const { error } = await supabase
    .from("crm_contactos")
    .update({ etapa_id: etapaId })
    .eq("id", contactoId);

  if (error) return { error: error.message };

  const esCrmLeads =
    (contactoActual?.empresas as unknown as { crm_modo: string } | null)?.crm_modo === "leads";

  if (esCrmLeads && contactoActual && contactoActual.etapa_id !== etapaId) {
    const idsEtapas = [contactoActual.etapa_id, etapaId].filter(Boolean) as string[];
    const { data: etapas } = await supabase.from("crm_etapas").select("id, nombre").in("id", idsEtapas);
    const nombreEtapa = (id: string | null) => etapas?.find((e) => e.id === id)?.nombre ?? null;

    const { error: errorHistorial } = await supabase.from("crm_historial_contacto").insert({
      contacto_id: contactoId,
      perfil_id: user?.id ?? null,
      campo: "Etapa",
      valor_anterior: nombreEtapa(contactoActual.etapa_id),
      valor_nuevo: nombreEtapa(etapaId),
    });
    if (errorHistorial) return { error: errorHistorial.message };
  }

  return { error: null };
}

export async function guardarCampoValor(input: {
  contactoId: string;
  campoId: string;
  valor: string | boolean | { nombre: string; url: string } | null;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: contacto, error: errorLectura } = await supabase
    .from("crm_contactos")
    .select("campos_etapa, empresas ( crm_modo )")
    .eq("id", input.contactoId)
    .single();

  if (errorLectura || !contacto) {
    return { error: errorLectura?.message ?? "No se encontró el contacto." };
  }

  const valorAnterior = (contacto.campos_etapa ?? {})[input.campoId] ?? null;
  const camposActualizados = { ...(contacto.campos_etapa ?? {}), [input.campoId]: input.valor };

  const { error } = await supabase
    .from("crm_contactos")
    .update({ campos_etapa: camposActualizados })
    .eq("id", input.contactoId);

  if (error) return { error: error.message };

  const esCrmLeads = (contacto.empresas as unknown as { crm_modo: string } | null)?.crm_modo === "leads";
  if (!esCrmLeads) return { error: null };

  const [{ data: campoEtapa }, { data: campoGeneral }] = await Promise.all([
    supabase.from("crm_etapa_campos").select("nombre").eq("id", input.campoId).maybeSingle(),
    supabase.from("crm_campos_generales").select("nombre").eq("id", input.campoId).maybeSingle(),
  ]);

  await supabase.from("crm_historial_contacto").insert({
    contacto_id: input.contactoId,
    perfil_id: user?.id ?? null,
    campo: campoEtapa?.nombre ?? campoGeneral?.nombre ?? "Campo personalizado",
    valor_anterior: formatearValorHistorial(valorAnterior),
    valor_nuevo: formatearValorHistorial(input.valor),
  });

  return { error: null };
}

// Duración fija de 30 minutos — no hay ningún campo en la app para elegir
// otra cosa todavía, y así se evita pedirle un dato más a alguien que solo
// quiere dejar un recordatorio rápido de seguimiento.
const DURACION_SEGUIMIENTO_MINUTOS = 30;

export async function agendarSeguimiento(input: {
  contactoId: string;
  titulo: string;
  fechaInicio: string;
  nota: string;
  invitados: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  if (!input.titulo.trim()) return { error: "Escribe un título para el evento." };

  const inicio = new Date(input.fechaInicio);
  if (Number.isNaN(inicio.getTime())) return { error: "Elige una fecha y hora válidas." };
  const fin = new Date(inicio.getTime() + DURACION_SEGUIMIENTO_MINUTOS * 60 * 1000);
  const invitados = input.invitados
    .split(",")
    .map((correo) => correo.trim())
    .filter(Boolean);

  const resultado = await crearEventoCalendar({
    perfilId: user.id,
    titulo: input.titulo.trim(),
    descripcion: input.nota || "Seguimiento agendado desde Datum.",
    fechaInicioISO: inicio.toISOString(),
    fechaFinISO: fin.toISOString(),
    invitados,
  });
  if ("error" in resultado) return { error: resultado.error };

  const { error } = await supabase.from("crm_eventos_calendar").insert({
    contacto_id: input.contactoId,
    perfil_id: user.id,
    google_event_id: resultado.googleEventId,
    link: resultado.link,
    meet_link: resultado.meetLink,
    titulo: input.titulo.trim(),
    fecha: inicio.toISOString(),
    nota: input.nota || null,
  });

  if (error) return { error: error.message };

  await supabase.from("crm_historial_contacto").insert({
    contacto_id: input.contactoId,
    perfil_id: user.id,
    campo: "Seguimiento",
    valor_anterior: null,
    valor_nuevo: `${input.titulo.trim()} — ${inicio.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}`,
  });

  return { error: null };
}

export async function cancelarSeguimiento(eventoId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { data: evento } = await supabase
    .from("crm_eventos_calendar")
    .select("contacto_id, google_event_id, titulo, fecha")
    .eq("id", eventoId)
    .single();

  if (evento) {
    const resultado = await eliminarEventoCalendar(user.id, evento.google_event_id);
    if (resultado.error) return { error: resultado.error };
  }

  const { error } = await supabase.from("crm_eventos_calendar").delete().eq("id", eventoId);
  if (error) return { error: error.message };

  if (evento) {
    await supabase.from("crm_historial_contacto").insert({
      contacto_id: evento.contacto_id,
      perfil_id: user.id,
      campo: "Seguimiento",
      valor_anterior: `${evento.titulo} — ${new Date(evento.fecha).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}`,
      valor_nuevo: "Cancelado",
    });
  }

  return { error: null };
}

export async function agregarInteraccion(input: {
  contactoId: string;
  fecha: string;
  tipo: string;
  nota: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("crm_interacciones").insert({
    contacto_id: input.contactoId,
    fecha: input.fecha,
    tipo: input.tipo,
    nota: input.nota,
  });

  if (error) return { error: error.message };

  const { data: contacto } = await supabase
    .from("crm_contactos")
    .select("empresas ( crm_modo )")
    .eq("id", input.contactoId)
    .single();
  const esCrmLeads = (contacto?.empresas as unknown as { crm_modo: string } | null)?.crm_modo === "leads";

  if (esCrmLeads) {
    await supabase.from("crm_historial_contacto").insert({
      contacto_id: input.contactoId,
      perfil_id: user?.id ?? null,
      campo: "Interacción",
      valor_anterior: null,
      valor_nuevo: `${input.tipo}: ${input.nota}`,
    });
  }

  return { error: null };
}

// Nunca se puede borrar un contacto que ya tiene ventas, apartados,
// devoluciones o cupones reales — perder ese historial financiero sería
// mucho peor que no poder borrar un contacto. Solo se puede borrar un
// contacto que sigue siendo, de verdad, un lead sin convertir.
export async function borrarContacto(contactoId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const [{ count: ventas }, { count: apartados }, { count: devoluciones }, { count: cupones }] =
    await Promise.all([
      supabase.from("ventas").select("id", { count: "exact", head: true }).eq("contacto_id", contactoId),
      supabase.from("apartados").select("id", { count: "exact", head: true }).eq("contacto_id", contactoId),
      supabase.from("devoluciones").select("id", { count: "exact", head: true }).eq("contacto_id", contactoId),
      supabase.from("cupones").select("id", { count: "exact", head: true }).eq("contacto_id", contactoId),
    ]);

  if ((ventas ?? 0) > 0 || (apartados ?? 0) > 0 || (devoluciones ?? 0) > 0 || (cupones ?? 0) > 0) {
    return {
      error:
        "No puedes borrar este cliente: ya tiene ventas, apartados, devoluciones o cupones registrados.",
    };
  }

  const { data: eventos } = await supabase
    .from("crm_eventos_calendar")
    .select("google_event_id, perfil_id")
    .eq("contacto_id", contactoId);

  for (const evento of eventos ?? []) {
    await eliminarEventoCalendar(evento.perfil_id, evento.google_event_id);
  }

  await supabase.from("crm_eventos_calendar").delete().eq("contacto_id", contactoId);
  await supabase.from("crm_interacciones").delete().eq("contacto_id", contactoId);
  await supabase.from("crm_historial_contacto").delete().eq("contacto_id", contactoId);

  const { error } = await supabase.from("crm_contactos").delete().eq("id", contactoId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function actualizarValorEstimado(
  contactoId: string,
  valor: number | null,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: anterior } = await supabase
    .from("crm_contactos")
    .select("valor_estimado")
    .eq("id", contactoId)
    .single();

  const { error } = await supabase
    .from("crm_contactos")
    .update({ valor_estimado: valor })
    .eq("id", contactoId);
  if (error) return { error: error.message };

  await supabase.from("crm_historial_contacto").insert({
    contacto_id: contactoId,
    perfil_id: user?.id ?? null,
    campo: "Valor estimado",
    valor_anterior: formatearValorHistorial(
      anterior?.valor_estimado != null ? String(anterior.valor_estimado) : null,
    ),
    valor_nuevo: formatearValorHistorial(valor != null ? String(valor) : null),
  });

  return { error: null };
}

export async function actualizarPrioridad(
  contactoId: string,
  prioridad: number | null,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: anterior } = await supabase
    .from("crm_contactos")
    .select("prioridad")
    .eq("id", contactoId)
    .single();

  const { error } = await supabase.from("crm_contactos").update({ prioridad }).eq("id", contactoId);
  if (error) return { error: error.message };

  await supabase.from("crm_historial_contacto").insert({
    contacto_id: contactoId,
    perfil_id: user?.id ?? null,
    campo: "Prioridad",
    valor_anterior: anterior?.prioridad != null ? String(anterior.prioridad) : null,
    valor_nuevo: prioridad != null ? String(prioridad) : null,
  });

  return { error: null };
}

export async function actualizarProductosInteres(
  contactoId: string,
  itemIds: string[],
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("crm_contactos")
    .update({ productos_interes: itemIds })
    .eq("id", contactoId);
  if (error) return { error: error.message };

  await supabase.from("crm_historial_contacto").insert({
    contacto_id: contactoId,
    perfil_id: user?.id ?? null,
    campo: "Productos de interés",
    valor_anterior: null,
    valor_nuevo: itemIds.length > 0 ? `${itemIds.length} producto(s) elegido(s)` : "Ninguno",
  });

  return { error: null };
}

export async function actualizarResponsable(
  contactoId: string,
  responsableId: string | null,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: anterior } = await supabase
    .from("crm_contactos")
    .select("responsable:responsable_id ( nombre )")
    .eq("id", contactoId)
    .single();

  const { data: nuevo } = responsableId
    ? await supabase.from("crm_responsables").select("nombre").eq("id", responsableId).maybeSingle()
    : { data: null };

  const { error } = await supabase
    .from("crm_contactos")
    .update({ responsable_id: responsableId })
    .eq("id", contactoId);
  if (error) return { error: error.message };

  await supabase.from("crm_historial_contacto").insert({
    contacto_id: contactoId,
    perfil_id: user?.id ?? null,
    campo: "Responsable",
    valor_anterior: (anterior?.responsable as unknown as { nombre: string } | null)?.nombre ?? null,
    valor_nuevo: nuevo?.nombre ?? null,
  });

  return { error: null };
}

export async function crearResponsable(
  nombre: string,
): Promise<{ error: string | null; id?: string }> {
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
  if (!perfil?.empresa_id) return { error: "Tu usuario no tiene una empresa asignada." };

  if (!nombre.trim()) return { error: "Escribe un nombre." };

  const { data, error } = await supabase
    .from("crm_responsables")
    .insert({ empresa_id: perfil.empresa_id, nombre: nombre.trim() })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { error: null, id: data.id as string };
}
