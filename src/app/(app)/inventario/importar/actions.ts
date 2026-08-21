"use server";

import { createClient } from "@/lib/supabase/server";

export type FilaImportacion = {
  nombre: string;
  categoria: string;
  unidad: string;
  cantidad: number;
  costo: number;
  precioVenta: number;
  esInsumo: boolean;
};

export async function cargarInventarioInicial(
  filas: FilaImportacion[],
  reemplazar: boolean,
  puntoVentaId?: string | null,
): Promise<{ error: string | null; creados: number | null; actualizados: number | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa.", creados: null, actualizados: null };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return { error: "Tu usuario no tiene una empresa asignada.", creados: null, actualizados: null };
  }

  const { data, error } = await supabase.rpc("cargar_inventario_inicial", {
    p_empresa_id: perfil.empresa_id,
    p_items: filas.map((f) => ({
      nombre: f.nombre,
      categoria: f.categoria,
      unidad: f.unidad,
      cantidad: f.cantidad,
      costo: f.costo,
      precio_venta: f.precioVenta,
      es_insumo: f.esInsumo,
    })),
    p_reemplazar: reemplazar,
    p_punto_venta_id: puntoVentaId ?? null,
  });

  if (error) return { error: error.message, creados: null, actualizados: null };

  const creados = data as number;
  return { error: null, creados, actualizados: filas.length - creados };
}

export type FilaRecetaImportacion = {
  producto: string;
  insumo: string;
  cantidad: number;
};

export async function cargarRecetasIniciales(
  filas: FilaRecetaImportacion[],
  puntoVentaId?: string | null,
): Promise<{ error: string | null; creadas: number | null; errores: string[] | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa.", creadas: null, errores: null };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return { error: "Tu usuario no tiene una empresa asignada.", creadas: null, errores: null };
  }

  const { data, error } = await supabase.rpc("cargar_recetas_iniciales", {
    p_empresa_id: perfil.empresa_id,
    p_recetas: filas.map((f) => ({
      producto: f.producto,
      insumo: f.insumo,
      cantidad: f.cantidad,
    })),
    p_punto_venta_id: puntoVentaId ?? null,
  });

  if (error) return { error: error.message, creadas: null, errores: null };

  const resultado = data as { creadas: number; errores: string[] };
  return { error: null, creadas: resultado.creadas, errores: resultado.errores };
}
