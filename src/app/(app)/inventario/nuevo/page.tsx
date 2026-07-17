import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { obtenerContextoPunto } from "@/lib/puntos";
import { NuevoProductoForm } from "./nuevo-producto-form";

export default async function NuevoProductoPage({
  searchParams,
}: {
  searchParams: Promise<{ nombre?: string; volver?: string }>;
}) {
  const { nombre, volver } = await searchParams;

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
    .select(
      "id, nombre, categoria, cantidad, costo, precio_venta, unidad, proveedor_id, sku, es_insumo, punto_venta_id",
    )
    .eq("empresa_id", perfil.empresa_id)
    .order("nombre");

  const { data: proveedores } = await supabase
    .from("proveedores")
    .select("id, nombre")
    .eq("empresa_id", perfil.empresa_id)
    .order("nombre");

  const { puntosVenta, puntoSeleccionado } = await obtenerContextoPunto(
    supabase,
    perfil.empresa_id,
    null,
  );

  return (
    <NuevoProductoForm
      items={items ?? []}
      proveedores={proveedores ?? []}
      nombreInicial={nombre ?? ""}
      volverAReceta={volver === "receta"}
      puntosVenta={puntosVenta}
      puntoInicial={puntoSeleccionado}
    />
  );
}
