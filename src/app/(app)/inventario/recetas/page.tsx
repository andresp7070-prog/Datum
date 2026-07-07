import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DirectorioRecetas } from "./directorio-recetas";

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
    .select("id, nombre, categoria")
    .eq("empresa_id", perfil.empresa_id)
    .order("nombre");

  const itemIds = (items ?? []).map((item) => item.id);

  const { data: recetaRows } =
    itemIds.length > 0
      ? await supabase
          .from("inventario_receta")
          .select("item_resultante_id")
          .in("item_resultante_id", itemIds)
      : { data: [] as { item_resultante_id: string }[] };

  const conteoPorItem: Record<string, number> = {};
  for (const fila of recetaRows ?? []) {
    conteoPorItem[fila.item_resultante_id] = (conteoPorItem[fila.item_resultante_id] ?? 0) + 1;
  }

  const itemsConConteo = (items ?? []).map((item) => ({
    ...item,
    insumos: conteoPorItem[item.id] ?? 0,
  }));

  return <DirectorioRecetas items={itemsConConteo} />;
}
