import { notFound } from "next/navigation";
import Link from "next/link";
import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { FactusClienteForm } from "./factus-cliente-form";

export default async function FactusClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirAdmin();
  const { id } = await params;

  const supabase = await createClient();

  const [{ data: empresa }, { data: integracion }] = await Promise.all([
    supabase.from("empresas").select("id, nombre, responsable_iva").eq("id", id).maybeSingle(),
    supabase
      .from("integraciones_factus")
      .select(
        "factus_client_id, factus_client_secret, factus_username, factus_password, numbering_range_id, numbering_range_id_notas_credito, numbering_range_id_notas_debito, certificado_facturacion, estado",
      )
      .eq("empresa_id", id)
      .maybeSingle(),
  ]);

  if (!empresa) notFound();

  return (
    <div className="max-w-md">
      <Link href="/admin" className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-700">
        ← Volver a Empresas
      </Link>
      <FactusClienteForm
        empresaId={empresa.id}
        nombreEmpresa={empresa.nombre}
        factusClientId={integracion?.factus_client_id ?? ""}
        factusClientSecret={integracion?.factus_client_secret ?? ""}
        factusUsername={integracion?.factus_username ?? ""}
        factusPassword={integracion?.factus_password ?? ""}
        numberingRangeId={
          integracion?.numbering_range_id != null ? String(integracion.numbering_range_id) : ""
        }
        numberingRangeIdNotasCredito={
          integracion?.numbering_range_id_notas_credito != null
            ? String(integracion.numbering_range_id_notas_credito)
            : ""
        }
        numberingRangeIdNotasDebito={
          integracion?.numbering_range_id_notas_debito != null
            ? String(integracion.numbering_range_id_notas_debito)
            : ""
        }
        certificadoFacturacion={integracion?.certificado_facturacion ?? "anual"}
        estado={integracion?.estado ?? null}
        responsableIvaInicial={empresa.responsable_iva}
      />
    </div>
  );
}
