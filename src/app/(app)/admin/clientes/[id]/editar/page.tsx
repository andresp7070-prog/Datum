import { notFound } from "next/navigation";
import Link from "next/link";
import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { EditarClienteForm } from "./editar-cliente-form";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirAdmin();
  const { id } = await params;

  const supabase = await createClient();

  const [{ data: empresa }, { data: suscripcion }] = await Promise.all([
    supabase.from("empresas").select("id, nombre, modulos_activos").eq("id", id).maybeSingle(),
    supabase
      .from("suscripciones")
      .select("plan, monto_mensual, facturacion")
      .eq("empresa_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!empresa) notFound();

  return (
    <div className="max-w-md">
      <Link href="/admin" className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-700">
        ← Volver a Empresas
      </Link>
      <EditarClienteForm
        empresaId={empresa.id}
        nombreEmpresa={empresa.nombre}
        modulosActivos={(empresa.modulos_activos ?? []).filter((m: string) => m !== "insights")}
        plan={suscripcion?.plan ?? "basic"}
        montoMensual={suscripcion?.monto_mensual != null ? String(suscripcion.monto_mensual) : ""}
        facturacion={suscripcion?.facturacion ?? "mensual"}
        tieneSuscripcion={Boolean(suscripcion)}
      />
    </div>
  );
}
