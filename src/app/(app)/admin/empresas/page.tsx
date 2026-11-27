import Link from "next/link";
import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { BuscadorEmpresas } from "./buscador-empresas";

export default async function EmpresasPage() {
  await requerirAdmin();
  const supabase = await createClient();

  const { data: empresas, error: errorEmpresas } = await supabase
    .from("empresas")
    .select("id, nombre, tipo_negocio, modulos_activos, monto_mensual, activa, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Empresas</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/panel"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            Panel de control
          </Link>
          <Link
            href="/admin/leads"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            CRM
          </Link>
          <Link
            href="/admin/finanzas"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            Estado P y G
          </Link>
          <Link
            href="/admin/correos"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            Probar correos
          </Link>
        </div>
      </div>

      {errorEmpresas && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          Error al cargar empresas: {errorEmpresas.message}
        </div>
      )}

      <BuscadorEmpresas empresas={empresas ?? []} />
    </div>
  );
}
