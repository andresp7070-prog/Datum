import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DirectorioRecetas, type RecetaDetalle } from "./directorio-recetas";

export default async function RecetasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return (
      <p className="text-red-600">
        Tu usuario no tiene una empresa asignada. Pídele a un administrador que la configure.
      </p>
    );
  }

  const { data: items } = await supabase
    .from("inventario_items")
    .select("id, nombre, categoria, cantidad, unidad")
    .eq("empresa_id", perfil.empresa_id)
    .order("nombre");

  const itemsPorId = new Map((items ?? []).map((item) => [item.id, item]));
  const itemIds = (items ?? []).map((item) => item.id);

  const { data: recetaRows } =
    itemIds.length > 0
      ? await supabase
          .from("inventario_receta")
          .select("item_resultante_id, item_insumo_id, cantidad_insumo")
          .in("item_resultante_id", itemIds)
      : { data: [] as { item_resultante_id: string; item_insumo_id: string; cantidad_insumo: number }[] };

  const conteoPorItem: Record<string, number> = {};
  const detallePorItem: Record<string, RecetaDetalle> = {};

  for (const fila of recetaRows ?? []) {
    conteoPorItem[fila.item_resultante_id] = (conteoPorItem[fila.item_resultante_id] ?? 0) + 1;

    const insumo = itemsPorId.get(fila.item_insumo_id);
    if (!insumo) continue;

    const cantidadInsumo = Number(fila.cantidad_insumo);
    const stockInsumo = Number(insumo.cantidad ?? 0);
    const producible = cantidadInsumo > 0 ? Math.floor(stockInsumo / cantidadInsumo) : 0;

    const detalle = detallePorItem[fila.item_resultante_id] ?? {
      unidadesProducibles: Infinity,
      insumos: [],
    };
    detalle.insumos.push({
      nombre: insumo.nombre,
      unidad: insumo.unidad,
      stockDisponible: stockInsumo,
      cantidadNecesaria: cantidadInsumo,
    });
    detalle.unidadesProducibles = Math.min(detalle.unidadesProducibles, producible);
    detallePorItem[fila.item_resultante_id] = detalle;
  }

  const itemsConConteo = (items ?? []).map((item) => ({
    id: item.id,
    nombre: item.nombre,
    categoria: item.categoria,
    insumos: conteoPorItem[item.id] ?? 0,
  }));

  return <DirectorioRecetas items={itemsConConteo} detalles={detallePorItem} />;
}
