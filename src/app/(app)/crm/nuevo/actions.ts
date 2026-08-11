"use server";

import { createClient } from "@/lib/supabase/server";
import { formatearValorHistorial } from "@/lib/historial";

type ValorCampo = string | boolean | { nombre: string; url: string } | null;

function campoEstaVacio(valor: ValorCampo, tipo: string): boolean {
  if (tipo === "si_no") return false;
  if (tipo === "enlace") {
    return !valor || typeof valor !== "object" || !valor.nombre.trim() || !valor.url.trim();
  }
  return valor === null || valor === undefined || (typeof valor === "string" && !valor.trim());
}

export async function crearCliente(input: {
  nombre: string;
  telefono: string;
  email: string;
  empresaCliente: string;
  camposValores: Record<string, ValorCampo>;
}): Promise<{ error: string | null; id?: string }> {
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

  if (!perfil?.empresa_id) {
    return { error: "Tu usuario no tiene una empresa asignada." };
  }

  // Vuelve a calcular cuáles campos son obligatorios (generales + los de
  // la primera etapa) del lado del servidor — no basta con la validación
  // del formulario, que se puede saltar.
  const { data: camposGenerales } = await supabase
    .from("crm_campos_generales")
    .select("id, nombre, tipo")
    .eq("empresa_id", perfil.empresa_id);

  const { data: primeraEtapa } = await supabase
    .from("crm_etapas")
    .select("id")
    .eq("empresa_id", perfil.empresa_id)
    .order("orden")
    .limit(1)
    .maybeSingle();

  const { data: camposPrimeraEtapa } = primeraEtapa
    ? await supabase.from("crm_etapa_campos").select("id, nombre, tipo").eq("etapa_id", primeraEtapa.id)
    : { data: [] };

  const camposObligatorios = [...(camposGenerales ?? []), ...(camposPrimeraEtapa ?? [])];

  const campoFaltante = camposObligatorios.find((campo) =>
    campoEstaVacio(input.camposValores[campo.id] ?? null, campo.tipo),
  );
  if (campoFaltante) return { error: `El campo "${campoFaltante.nombre}" es obligatorio.` };

  const atributos = input.empresaCliente ? { empresa: input.empresaCliente } : {};

  const { data, error } = await supabase
    .from("crm_contactos")
    .insert({
      empresa_id: perfil.empresa_id,
      nombre: input.nombre,
      telefono: input.telefono,
      email: input.email,
      atributos,
      campos_etapa: input.camposValores,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (camposObligatorios.length > 0) {
    const historial = camposObligatorios.map((campo) => ({
      contacto_id: data.id as string,
      perfil_id: user.id,
      campo: campo.nombre,
      valor_anterior: null,
      valor_nuevo: formatearValorHistorial(input.camposValores[campo.id] ?? null),
    }));
    await supabase.from("crm_historial_contacto").insert(historial);
  }

  return { error: null, id: data.id as string };
}
