"use server";

import { createClient } from "@/lib/supabase/server";

// Genera el siguiente SKU secuencial de la empresa: 00000, 00001, 00002... —
// solo tiene en cuenta los SKU numéricos ya usados, para no romperse si
// alguien puso uno manual con letras.
async function siguienteSku(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
): Promise<string> {
  const { data } = await supabase
    .from("inventario_items")
    .select("sku")
    .eq("empresa_id", empresaId)
    .not("sku", "is", null);

  const maximo = (data ?? []).reduce((max, fila) => {
    const sku = fila.sku ?? "";
    if (!/^\d+$/.test(sku)) return max;
    return Math.max(max, Number(sku));
  }, -1);

  return String(maximo + 1).padStart(5, "0");
}

export async function crearProducto(input: {
  nombre: string;
  categoria: string;
  unidad: string;
  cantidad: number;
  costo: number;
  precioVenta: number | null;
  proveedorId?: string | null;
  sku?: string | null;
  esInsumo?: boolean;
  atributos?: Record<string, unknown>;
  puntoVentaId?: string | null;
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

  const skuFinal = input.sku?.trim() || (await siguienteSku(supabase, perfil.empresa_id));

  const { data, error } = await supabase
    .from("inventario_items")
    .insert({
      empresa_id: perfil.empresa_id,
      punto_venta_id: input.puntoVentaId ?? null,
      nombre: input.nombre,
      sku: skuFinal,
      categoria: input.categoria || null,
      unidad: input.unidad,
      cantidad: input.cantidad,
      costo: input.costo,
      precio_venta: input.esInsumo ? null : input.precioVenta,
      proveedor_id: input.proveedorId ?? null,
      es_insumo: input.esInsumo ?? false,
      atributos: input.atributos ?? {},
    })
    .select("id")
    .single();

  if (error) {
    if (error.message.includes("duplicate") || error.code === "23505") {
      return { error: `El SKU "${skuFinal}" ya lo está usando otro producto.` };
    }
    return { error: error.message };
  }

  // La cantidad inicial es su primer lote — así, si el costo cambia en la
  // próxima compra, esta primera tanda se sigue vendiendo a su costo real.
  if (input.cantidad > 0) {
    const { error: errorLote } = await supabase.from("inventario_lotes").insert({
      item_id: data.id,
      cantidad_disponible: input.cantidad,
      costo_unitario: input.costo,
    });
    if (errorLote) return { error: errorLote.message };
  }

  return { error: null, id: data.id as string };
}

export async function reabastecerProducto(input: {
  itemId: string;
  categoria: string;
  cantidadAgregada: number;
  costo: number;
  precioVenta: number | null;
  proveedorId?: string | null;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { error } = await supabase.rpc("reabastecer_producto", {
    p_item_id: input.itemId,
    p_cantidad_agregada: input.cantidadAgregada,
    p_costo: input.costo,
    p_precio_venta: input.precioVenta,
    p_categoria: input.categoria || null,
    p_proveedor_id: input.proveedorId ?? null,
  });

  if (error) return { error: error.message };
  return { error: null };
}
