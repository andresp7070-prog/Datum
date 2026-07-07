"use server";

import { createClient } from "@/lib/supabase/server";

export async function guardarReceta(input: {
  itemResultanteId: string;
  lineas: { insumoId: string; cantidad: number }[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesión activa.");

  const { error: errorBorrar } = await supabase
    .from("inventario_receta")
    .delete()
    .eq("item_resultante_id", input.itemResultanteId);

  if (errorBorrar) throw new Error(errorBorrar.message);

  if (input.lineas.length === 0) return;

  const { error: errorInsertar } = await supabase.from("inventario_receta").insert(
    input.lineas.map((linea) => ({
      item_resultante_id: input.itemResultanteId,
      item_insumo_id: linea.insumoId,
      cantidad_insumo: linea.cantidad,
    })),
  );

  if (errorInsertar) throw new Error(errorInsertar.message);
}

export async function registrarProduccion(input: {
  itemResultanteId: string;
  cantidad: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesión activa.");

  const { error } = await supabase.rpc("registrar_produccion", {
    p_item_resultante_id: input.itemResultanteId,
    p_cantidad_producida: input.cantidad,
  });

  if (error) throw new Error(error.message);
}
