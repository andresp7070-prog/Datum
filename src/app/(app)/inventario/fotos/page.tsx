import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { obtenerContextoPunto } from "@/lib/puntos";
import { InventarioTabs } from "../inventario-tabs";
import { FotosMasivasForm } from "./fotos-form";

export default async function FotosInventarioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id, punto_venta_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return (
      <p className="text-red-600">
        Tu usuario no tiene una empresa asignada. Pídele a un administrador que la configure.
      </p>
    );
  }

  // Ninguna depende de la otra — ambas solo necesitan perfil.
  const [{ puntosVenta, puntoSeleccionado }, { data: items }] = await Promise.all([
    obtenerContextoPunto(supabase, perfil.empresa_id, perfil.punto_venta_id),
    supabase.from("inventario_items").select("id, nombre, punto_venta_id, foto_path").eq("empresa_id", perfil.empresa_id).order("nombre"),
  ]);

  return (
    <div>
      <InventarioTabs />
      <FotosMasivasForm
        empresaId={perfil.empresa_id}
        items={items ?? []}
        puntosVenta={puntosVenta}
        puntoInicial={puntoSeleccionado}
      />
    </div>
  );
}
