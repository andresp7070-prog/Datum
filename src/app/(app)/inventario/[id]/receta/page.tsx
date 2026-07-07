import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { RecetaForm } from "./receta-form";

type RecetaFila = {
  item_insumo_id: string;
  cantidad_insumo: number;
};

export default async function RecetaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  const { data: item } = await supabase
    .from("inventario_items")
    .select("id, nombre")
    .eq("id", id)
    .single();

  if (!item) notFound();

  const { data: otrosItems } = await supabase
    .from("inventario_items")
    .select("id, nombre, unidad")
    .eq("empresa_id", perfil.empresa_id)
    .neq("id", id)
    .order("nombre");

  const { data: recetaData } = await supabase
    .from("inventario_receta")
    .select("item_insumo_id, cantidad_insumo")
    .eq("item_resultante_id", id);

  const receta = (recetaData ?? []) as RecetaFila[];

  return (
    <RecetaForm
      itemResultante={item}
      insumosDisponibles={otrosItems ?? []}
      recetaInicial={receta}
    />
  );
}
