import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { InventarioTabs } from "../inventario-tabs";
import { DirectorioProveedores, type ResumenProveedor } from "./directorio-proveedores";

export default async function ProveedoresPage() {
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

  const [{ data: proveedores }, { data: resumenesData }] = await Promise.all([
    supabase
      .from("proveedores")
      .select("id, nombre, telefono, frecuencia_pago, dia_semana_pago, dias_personalizado")
      .eq("empresa_id", perfil.empresa_id)
      .order("nombre"),
    supabase
      .from("vista_proveedores")
      .select("proveedor_id, ultima_compra, costo_promedio, categoria_mas_comprada, rentabilidad")
      .eq("empresa_id", perfil.empresa_id),
  ]);

  const resumenes: Record<string, ResumenProveedor> = {};
  for (const fila of resumenesData ?? []) {
    resumenes[fila.proveedor_id] = {
      ultima_compra: fila.ultima_compra,
      costo_promedio: fila.costo_promedio,
      categoria_mas_comprada: fila.categoria_mas_comprada,
      rentabilidad: Number(fila.rentabilidad ?? 0),
    };
  }

  return (
    <div>
      <InventarioTabs />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Proveedores</h1>
        <Link
          href="/inventario/proveedores/nuevo"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Agregar proveedor
        </Link>
      </div>

      <DirectorioProveedores proveedores={proveedores ?? []} resumenes={resumenes} />
    </div>
  );
}
