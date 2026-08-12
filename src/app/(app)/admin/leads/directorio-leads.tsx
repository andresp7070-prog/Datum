"use client";

import { useState } from "react";
import Link from "next/link";
import { sinTildes } from "@/lib/texto";
import { DescargarCsv } from "@/components/descargar-csv";
import { Estrellas } from "@/app/(app)/crm/estrellas";
import { cambiarEtapaLead, borrarLead } from "./[id]/actions";
import { ValorVentaModal } from "./valor-venta-modal";
import { BorrarLeadModal } from "./borrar-lead-modal";

type Lead = {
  id: string;
  nombre: string;
  empresa: string | null;
  telefono: string | null;
  email: string | null;
  etapa_id: string | null;
  valor_venta: number | null;
  calificacion: number | null;
};

type Etapa = { id: string; nombre: string; orden: number; es_cierre: boolean };

function TarjetaLead({
  lead,
  arrastrando,
  onDragStart,
  onDragEnd,
}: {
  lead: Lead;
  arrastrando: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`cursor-grab rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm active:cursor-grabbing ${
        arrastrando ? "opacity-40" : ""
      }`}
    >
      <Link href={`/admin/leads/${lead.id}`} className="block">
        <p className="text-sm font-medium text-gray-900">{lead.nombre}</p>
        <p className="text-xs text-gray-400">
          {lead.empresa ? `${lead.empresa} · ` : ""}
          {lead.telefono ?? "Sin teléfono"}
        </p>
        {lead.calificacion != null && (
          <div className="mt-1">
            <Estrellas valor={lead.calificacion} />
          </div>
        )}
      </Link>
    </div>
  );
}

export function DirectorioLeads({ leads: leadsIniciales, etapas }: { leads: Lead[]; etapas: Etapa[] }) {
  const [leads, setLeads] = useState(leadsIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [arrastrandoId, setArrastrandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dropPendiente, setDropPendiente] = useState<{ leadId: string; etapaId: string } | null>(
    null,
  );
  const [sobrePapelera, setSobrePapelera] = useState(false);
  const [leadPendienteBorrar, setLeadPendienteBorrar] = useState<{ id: string; nombre: string } | null>(
    null,
  );
  const [borrando, setBorrando] = useState(false);

  const q = sinTildes(busqueda.trim());
  const filtrados = leads.filter((lead) => {
    if (!q) return true;
    return sinTildes(lead.nombre).includes(q) || sinTildes(lead.empresa ?? "").includes(q);
  });

  const filasCsv = filtrados.map((lead) => {
    const nombrePorEtapa = new Map(etapas.map((etapa) => [etapa.id, etapa.nombre]));
    return {
      nombre: lead.nombre,
      empresa: lead.empresa ?? "",
      telefono: lead.telefono ?? "",
      email: lead.email ?? "",
      etapa: (lead.etapa_id && nombrePorEtapa.get(lead.etapa_id)) ?? "—",
    };
  });

  async function aplicarCambioEtapa(leadId: string, etapaId: string, valorVenta?: number) {
    const leadActual = leads.find((l) => l.id === leadId);
    const anterior = leadActual?.etapa_id ?? null;

    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? { ...l, etapa_id: etapaId, valor_venta: valorVenta ?? l.valor_venta }
          : l,
      ),
    );

    const resultado = await cambiarEtapaLead(leadId, etapaId, valorVenta);
    if (resultado.error) {
      setError(resultado.error);
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, etapa_id: anterior } : l)));
    }
  }

  async function soltarEn(etapaId: string) {
    if (!arrastrandoId) return;
    const leadId = arrastrandoId;
    setArrastrandoId(null);

    const leadArrastrado = leads.find((l) => l.id === leadId);
    if (!leadArrastrado || leadArrastrado.etapa_id === etapaId) return;

    const etapaDestino = etapas.find((e) => e.id === etapaId);
    if (etapaDestino?.es_cierre && leadArrastrado.valor_venta == null) {
      setDropPendiente({ leadId, etapaId });
      return;
    }

    await aplicarCambioEtapa(leadId, etapaId);
  }

  function soltarEnPapelera() {
    setSobrePapelera(false);
    if (!arrastrandoId) return;
    const lead = leads.find((l) => l.id === arrastrandoId);
    setArrastrandoId(null);
    if (!lead) return;
    setLeadPendienteBorrar({ id: lead.id, nombre: lead.nombre });
  }

  async function confirmarBorrado() {
    if (!leadPendienteBorrar) return;
    setBorrando(true);
    const resultado = await borrarLead(leadPendienteBorrar.id);
    setBorrando(false);
    if (resultado.error) {
      setError(resultado.error);
      setLeadPendienteBorrar(null);
      return;
    }
    setLeads((prev) => prev.filter((l) => l.id !== leadPendienteBorrar.id));
    setLeadPendienteBorrar(null);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
            ← Volver al panel
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-gray-900">Leads de Datum</h1>
        </div>
        <div className="flex gap-2">
          <DescargarCsv
            filas={filasCsv}
            columnas={[
              { clave: "nombre", titulo: "Nombre" },
              { clave: "empresa", titulo: "Empresa" },
              { clave: "telefono", titulo: "Teléfono" },
              { clave: "email", titulo: "Correo" },
              { clave: "etapa", titulo: "Etapa" },
            ]}
            nombreArchivo="leads-datum.csv"
          />
          <Link
            href="/admin/leads/etapas"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Configurar etapas
          </Link>
          <Link
            href="/admin/leads/nuevo"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Agregar lead
          </Link>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setSobrePapelera(true);
            }}
            onDragLeave={() => setSobrePapelera(false)}
            onDrop={soltarEnPapelera}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
              arrastrandoId
                ? sobrePapelera
                  ? "border-red-500 bg-red-50 text-red-600"
                  : "border-gray-400 bg-gray-50 text-gray-500"
                : "border-transparent text-gray-300"
            }`}
            title="Arrastra un lead aquí para borrarlo"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-8 0 1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o empresa"
          className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {etapas.length === 0 ? (
        <p className="text-gray-400">
          Todavía no hay etapas configuradas.{" "}
          <Link href="/admin/leads/etapas" className="text-accent hover:underline">
            Configúralas primero
          </Link>
          .
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {etapas.map((etapa) => {
            const leadsDeEtapa = filtrados.filter((l) => l.etapa_id === etapa.id);
            return (
              <div
                key={etapa.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => soltarEn(etapa.id)}
                className="w-64 shrink-0 rounded-xl border border-gray-200 bg-gray-50 p-3"
              >
                <div className="mb-3 flex items-center justify-between px-0.5">
                  <h2 className="text-sm font-semibold text-gray-900">{etapa.nombre}</h2>
                  <span className="text-xs text-gray-400">{leadsDeEtapa.length}</span>
                </div>
                <div className="min-h-[40px] space-y-2">
                  {leadsDeEtapa.map((lead) => (
                    <TarjetaLead
                      key={lead.id}
                      lead={lead}
                      arrastrando={arrastrandoId === lead.id}
                      onDragStart={() => setArrastrandoId(lead.id)}
                      onDragEnd={() => setArrastrandoId(null)}
                    />
                  ))}
                  {leadsDeEtapa.length === 0 && (
                    <p className="px-0.5 text-xs text-gray-400">Sin leads.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {leadPendienteBorrar && (
        <BorrarLeadModal
          nombreLead={leadPendienteBorrar.nombre}
          borrando={borrando}
          onConfirm={confirmarBorrado}
          onCancel={() => setLeadPendienteBorrar(null)}
        />
      )}

      {dropPendiente && (
        <ValorVentaModal
          onConfirm={(valorVenta) => {
            const pendiente = dropPendiente;
            setDropPendiente(null);
            aplicarCambioEtapa(pendiente.leadId, pendiente.etapaId, valorVenta);
          }}
          onCancel={() => setDropPendiente(null)}
        />
      )}
    </div>
  );
}
