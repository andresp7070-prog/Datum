"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { sinTildes } from "@/lib/texto";
import { DescargarCsv } from "@/components/descargar-csv";
import { Estrellas } from "@/app/(app)/crm/estrellas";
import { PrioridadBadge, PrioridadFiltro } from "@/app/(app)/crm/prioridad";
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
  prioridad: number | null;
};

type Etapa = { id: string; nombre: string; orden: number; es_cierre: boolean };

// Umbral en píxeles antes de considerar que el puntero se movió lo
// suficiente como para ser un arrastre y no un clic normal.
const UMBRAL_ARRASTRE = 6;

function TarjetaLead({
  lead,
  arrastrando,
  bloquearClicRef,
  onPointerDown,
}: {
  lead: Lead;
  arrastrando: boolean;
  bloquearClicRef: React.MutableRefObject<boolean>;
  onPointerDown: (e: React.PointerEvent, lead: Lead) => void;
}) {
  return (
    <div
      onPointerDown={(e) => onPointerDown(e, lead)}
      className={`touch-none select-none rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm ${
        arrastrando ? "cursor-grabbing opacity-40" : "cursor-grab"
      }`}
    >
      <Link
        href={`/admin/leads/${lead.id}`}
        onClick={(e) => {
          if (bloquearClicRef.current) {
            e.preventDefault();
            bloquearClicRef.current = false;
          }
        }}
        className="block"
      >
        <p className="text-sm font-medium text-gray-900">{lead.nombre}</p>
        <p className="text-xs text-gray-400">
          {lead.empresa ? `${lead.empresa} · ` : ""}
          {lead.telefono ?? "Sin teléfono"}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          {lead.calificacion != null && <Estrellas valor={lead.calificacion} />}
          <PrioridadBadge valor={lead.prioridad} />
        </div>
      </Link>
    </div>
  );
}

export function DirectorioLeads({ leads: leadsIniciales, etapas }: { leads: Lead[]; etapas: Etapa[] }) {
  const [leads, setLeads] = useState(leadsIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [prioridadFiltro, setPrioridadFiltro] = useState("todas");
  const [arrastrandoId, setArrastrandoId] = useState<string | null>(null);
  const [zonaActiva, setZonaActiva] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dropPendiente, setDropPendiente] = useState<{ leadId: string; etapaId: string } | null>(
    null,
  );
  const [leadPendienteBorrar, setLeadPendienteBorrar] = useState<{ id: string; nombre: string } | null>(
    null,
  );
  const [borrando, setBorrando] = useState(false);

  const bloquearClicRef = useRef(false);
  const arrastreRef = useRef<{ leadId: string; startX: number; startY: number; moved: boolean } | null>(
    null,
  );

  const q = sinTildes(busqueda.trim());
  const filtrados = leads.filter((lead) => {
    const coincideTexto =
      !q || sinTildes(lead.nombre).includes(q) || sinTildes(lead.empresa ?? "").includes(q);
    const coincidePrioridad =
      prioridadFiltro === "todas" ||
      (prioridadFiltro === "sin" ? lead.prioridad == null : lead.prioridad === Number(prioridadFiltro));
    return coincideTexto && coincidePrioridad;
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

  async function soltarEn(leadId: string, etapaId: string) {
    const leadArrastrado = leads.find((l) => l.id === leadId);
    if (!leadArrastrado || leadArrastrado.etapa_id === etapaId) return;

    const etapaDestino = etapas.find((e) => e.id === etapaId);
    if (etapaDestino?.es_cierre && leadArrastrado.valor_venta == null) {
      setDropPendiente({ leadId, etapaId });
      return;
    }

    await aplicarCambioEtapa(leadId, etapaId);
  }

  function soltarEnPapelera(leadId: string) {
    const lead = leads.find((l) => l.id === leadId);
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

  // Arrastre implementado con eventos de puntero + seguimiento manual de
  // posición, en vez del "drag nativo" del navegador (draggable/dragstart):
  // ese mecanismo nativo es justo el que en macOS a veces dispara el gesto
  // de "vista dividida" del sistema operativo. Así, el sistema operativo
  // nunca se entera de que hay un arrastre en curso.
  function iniciarArrastre(e: React.PointerEvent, lead: Lead) {
    if (e.button !== 0) return;
    arrastreRef.current = { leadId: lead.id, startX: e.clientX, startY: e.clientY, moved: false };
    window.addEventListener("pointermove", moverArrastre);
    window.addEventListener("pointerup", soltarArrastre);
  }

  function zonaBajoPuntero(x: number, y: number): string | null {
    const elemento = document.elementFromPoint(x, y);
    const zona = elemento?.closest("[data-drop-zone]") as HTMLElement | null;
    return zona?.dataset.dropZone ?? null;
  }

  function moverArrastre(e: PointerEvent) {
    const d = arrastreRef.current;
    if (!d) return;

    if (!d.moved) {
      const distancia = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      if (distancia < UMBRAL_ARRASTRE) return;
      d.moved = true;
      setArrastrandoId(d.leadId);
    }

    setZonaActiva(zonaBajoPuntero(e.clientX, e.clientY));
  }

  function soltarArrastre(e: PointerEvent) {
    window.removeEventListener("pointermove", moverArrastre);
    window.removeEventListener("pointerup", soltarArrastre);

    const d = arrastreRef.current;
    arrastreRef.current = null;
    setArrastrandoId(null);
    setZonaActiva(null);

    if (!d || !d.moved) return;
    bloquearClicRef.current = true;

    const destino = zonaBajoPuntero(e.clientX, e.clientY);
    if (!destino) return;

    if (destino === "papelera") {
      soltarEnPapelera(d.leadId);
    } else {
      soltarEn(d.leadId, destino);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
            ← Volver al panel
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-gray-900">CRM</h1>
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
            data-drop-zone="papelera"
            className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
              arrastrandoId
                ? zonaActiva === "papelera"
                  ? "border-red-500 bg-red-50 text-red-600"
                  : "border-gray-400 bg-gray-50 text-gray-500"
                : "border-transparent text-gray-300"
            }`}
            title="Arrastra un lead aquí para borrarlo"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-8 0 1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o empresa"
          className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <PrioridadFiltro valor={prioridadFiltro} onChange={setPrioridadFiltro} />
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
                data-drop-zone={etapa.id}
                className={`w-64 shrink-0 rounded-xl border p-3 transition-colors ${
                  zonaActiva === etapa.id
                    ? "border-accent bg-accent/5"
                    : "border-gray-200 bg-gray-50"
                }`}
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
                      bloquearClicRef={bloquearClicRef}
                      onPointerDown={iniciarArrastre}
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
