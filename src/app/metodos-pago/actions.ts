"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// marcar predeterminado y borrar corren con la sesión normal del cliente a
// propósito (no con la llave de servicio) — RLS ya limita ambas acciones a
// las propias filas de su empresa (ver schema.sql), y las dos solo operan
// sobre métodos que ya pasaron por la tokenización real con Wompi.

export async function marcarPredeterminado(
  metodoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_metodo_pago_predeterminado", {
    p_metodo_id: metodoId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/metodos-pago");
  return { ok: true };
}

export async function borrarMetodo(
  metodoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data: metodo } = await supabase
    .from("metodos_pago")
    .select("empresa_id, es_predeterminado")
    .eq("id", metodoId)
    .single();
  if (!metodo) return { ok: false, error: "No se encontró ese método de pago." };

  const { error } = await supabase.from("metodos_pago").delete().eq("id", metodoId);
  if (error) return { ok: false, error: error.message };

  // Si se borró la que se usaba para cobrar y quedan otras, se promueve la
  // más reciente — para que nunca quede sin ninguna marcada mientras haya
  // alternativas, y el cobro del próximo mes no se quede sin saber cuál usar.
  if (metodo.es_predeterminado) {
    const { data: otro } = await supabase
      .from("metodos_pago")
      .select("id")
      .eq("empresa_id", metodo.empresa_id)
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (otro) {
      await supabase.rpc("marcar_metodo_pago_predeterminado", { p_metodo_id: otro.id });
    }
  }

  revalidatePath("/metodos-pago");
  return { ok: true };
}
