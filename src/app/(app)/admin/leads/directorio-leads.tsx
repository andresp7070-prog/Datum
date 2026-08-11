"use client";

import { useState } from "react";
import Link from "next/link";
import { sinTildes } from "@/lib/texto";
import { DescargarCsv } from "@/components/descargar-csv";
import { Estrellas } from "@/app/(app)/crm/estrellas";

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

export function DirectorioLeads({ leads, etapas }: { leads: Lead[]; etapas: Etapa[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [etapaFiltro, setEtapaFiltro] = useState("todas");

  const nombrePorEtapa = new Map(etapas.map((etapa) => [etapa.id, etapa.nombre]));

  const filtrados = leads.filter((lead) => {
    const coincideEtapa = etapaFiltro === "todas" || lead.etapa_id === etapaFiltro;
    const q = sinTildes(busqueda.trim());
    const coincideTexto =
      !q || sinTildes(lead.nombre).includes(q) || sinTildes(lead.empresa ?? "").includes(q);
    return coincideEtapa && coincideTexto;
  });

  const filasCsv = filtrados.map((lead) => ({
    nombre: lead.nombre,
    empresa: lead.empresa ?? "",
    telefono: lead.telefono ?? "",
    email: lead.email ?? "",
    etapa: (lead.etapa_id && nombrePorEtapa.get(lead.etapa_id)) ?? "—",
  }));

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

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o empresa"
          className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <select
          value={etapaFiltro}
          onChange={(e) => setEtapaFiltro(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        >
          <option value="todas">Todas</option>
          {etapas.map((etapa) => (
            <option key={etapa.id} value={etapa.id}>
              {etapa.nombre}
            </option>
          ))}
        </select>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-gray-400">No hay leads que coincidan.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
          {filtrados.map((lead) => (
            <li key={lead.id}>
              <Link
                href={`/admin/leads/${lead.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div>
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
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                  {(lead.etapa_id && nombrePorEtapa.get(lead.etapa_id)) ?? "—"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
