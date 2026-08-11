import { notFound } from "next/navigation";
import Link from "next/link";
import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { CambiarEtapa } from "./cambiar-etapa";
import { NuevaInteraccionForm } from "./nueva-interaccion-form";
import { CalificarLead } from "./calificar-lead";

const etiquetaTipoInteraccion: Record<string, string> = {
  llamada: "Llamada",
  email: "Correo",
  reunion: "Reunión",
  otro: "Otro",
};

export default async function FichaLeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string }>;
}) {
  await requerirAdmin();

  const { id } = await params;
  const { creado } = await searchParams;

  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("datum_leads")
    .select("id, nombre, empresa, telefono, email, etapa_id, calificacion, notas")
    .eq("id", id)
    .single();

  if (!lead) notFound();

  const { data: etapas } = await supabase
    .from("datum_crm_etapas")
    .select("id, nombre, orden")
    .order("orden");

  const { data: interacciones } = await supabase
    .from("datum_crm_interacciones")
    .select("*")
    .eq("lead_id", id)
    .order("fecha", { ascending: false });

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/leads" className="text-sm text-gray-500 hover:text-gray-700">
        ← Volver a Leads
      </Link>

      {creado === "1" && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Lead creado correctamente.
        </p>
      )}

      <div className="rounded-xl border border-gray-200 p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{lead.nombre}</h1>
            {lead.empresa && <p className="text-sm text-gray-500">{lead.empresa}</p>}
            <p className="mt-1 text-sm text-gray-500">
              {lead.telefono ?? "Sin teléfono"} · {lead.email ?? "Sin correo"}
            </p>
            <div className="mt-2">
              <CalificarLead leadId={lead.id} calificacionInicial={lead.calificacion} />
            </div>
          </div>
          <CambiarEtapa leadId={lead.id} etapas={etapas ?? []} etapaActualId={lead.etapa_id} />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Interacciones</h2>
        {interacciones && interacciones.length > 0 ? (
          <ul className="mb-4 divide-y divide-gray-200">
            {interacciones.map((interaccion) => (
              <li key={interaccion.id} className="py-2 text-sm">
                <p className="text-gray-500">
                  {new Date(interaccion.fecha).toLocaleDateString("es-CO")} ·{" "}
                  {etiquetaTipoInteraccion[interaccion.tipo ?? "otro"] ?? interaccion.tipo}
                </p>
                <p className="text-gray-900">{interaccion.nota}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-gray-400">Sin interacciones registradas todavía.</p>
        )}

        <NuevaInteraccionForm leadId={lead.id} />
      </div>
    </div>
  );
}
