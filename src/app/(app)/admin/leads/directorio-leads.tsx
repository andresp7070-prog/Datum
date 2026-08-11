"use client";

import { useState } from "react";
import Link from "next/link";
import { sinTildes } from "@/lib/texto";
import { DescargarCsv } from "@/components/descargar-csv";
import { Estrellas } from "@/app/(app)/crm/estrellas";
import { cambiarEtapaLead } from "./[id]/actions";

type Lead = {
  id: string;
  nombre: string;
  empresa: string | null;
  telefono: string | null;
  email: string | null;
  etapa_id: string | null;
  calificacion: number | null;
};

type Etapa = { id: string; nombre: string; orden: number };

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

  async function soltarEn(etapaId: string) {
    if (!arrastrandoId) return;
    const leadId = arrastrandoId;
    setArrastrandoId(null);

    const leadArrastrado = leads.find((l) => l.id === leadId);
    if (!leadArrastrado || leadArrastrado.etapa_id === etapaId) return;

    const anterior = leadArrastrado.etapa_id;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, etapa_id: etapaId } : l)));

    const resultado = await cambiarEtapaLead(leadId, etapaId);
    if (resultado.error) {
      setError(resultado.error);
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, etapa_id: anterior } : l)));
    }
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
    </div>
  );
}
