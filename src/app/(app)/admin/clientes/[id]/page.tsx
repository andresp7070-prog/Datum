import { notFound } from "next/navigation";
import Link from "next/link";
import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { EstadoEmpresa } from "./estado-empresa";

// Mismos mapas que /admin/page.tsx — se duplican a propósito, mismo
// criterio que ya acepta este proyecto (ver editar-cliente-form.tsx).
const NOMBRE_MODULO: Record<string, string> = {
  ventas: "Ventas",
  crm: "CRM",
  inventario: "Inventario",
  pyg: "Estado P y G",
  insights: "Panel de control",
  promociones: "Promociones",
  nomina: "Nómina",
};

const NOMBRE_TIPO_NEGOCIO: Record<string, string> = {
  aseo: "Aseo",
  ropa: "Ropa",
  restaurante: "Restaurante",
  cafeteria: "Cafetería",
  belleza: "Belleza",
  ferreteria: "Ferretería",
  taller: "Taller",
  tienda: "Tienda",
  papeleria: "Papelería",
  otro: "Otro",
};

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

// Ficha de empresa — un solo lugar por cliente en vez de enlaces sueltos en
// la tabla de /admin (agregado 2026-11-19, a pedido explícito de Andrés).
export default async function FichaEmpresaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, nombre, tipo_negocio, modulos_activos, monto_mensual, activa, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!empresa) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/admin" className="inline-block text-sm text-gray-500 hover:text-gray-700">
        ← Volver a Empresas
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{empresa.nombre}</h1>
        <EstadoEmpresa
          empresaId={empresa.id}
          activaInicial={empresa.activa}
          nombreEmpresa={empresa.nombre}
        />
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Información</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400">Tipo de negocio</p>
            <p className="mt-1 text-gray-900">
              {empresa.tipo_negocio
                ? NOMBRE_TIPO_NEGOCIO[empresa.tipo_negocio] ?? empresa.tipo_negocio
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Cliente desde</p>
            <p className="mt-1 text-gray-900">
              {new Date(empresa.created_at).toLocaleDateString("es-CO")}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Módulos activos</p>
            <p className="mt-1 text-gray-900">
              {(empresa.modulos_activos ?? [])
                .map((m: string) => NOMBRE_MODULO[m] ?? m)
                .join(", ") || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Mensualidad</p>
            <p className="mt-1 text-gray-900">
              {empresa.monto_mensual ? formatoMoneda(Number(empresa.monto_mensual)) : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Gestión</h2>
        <div className="flex flex-col gap-2">
          <Link
            href={`/admin/clientes/${empresa.id}/editar`}
            className="text-sm font-medium text-accent hover:underline"
          >
            Editar plan →
          </Link>
          <Link
            href={`/admin/clientes/${empresa.id}/factus`}
            className="text-sm font-medium text-accent hover:underline"
          >
            Facturación electrónica →
          </Link>
        </div>
      </div>
    </div>
  );
}
