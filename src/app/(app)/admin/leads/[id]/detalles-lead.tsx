"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrioridadSelector } from "@/app/(app)/crm/prioridad";
import { ResponsableSelector } from "@/app/(app)/crm/responsable-selector";
import { MultiSelector } from "@/app/(app)/crm/multi-selector";
import {
  actualizarValorEstimadoLead,
  actualizarPrioridadLead,
  actualizarModulosInteresLead,
  actualizarResponsableLead,
  crearResponsableLead,
} from "./actions";

// Respaldo mientras la empresa propia del admin no tenga Inventario activo
// con servicios cargados — en cuanto los tenga, serviciosDisponibles deja de
// ser null y "Módulos de interés" pasa a mostrar el catálogo real en vez de
// esta lista fija. Ver actualización en CLAUDE.md.
const MODULOS_DATUM = [
  { value: "ventas", label: "Ventas" },
  { value: "crm", label: "CRM" },
  { value: "inventario", label: "Inventario" },
  { value: "pyg", label: "Estado de resultados" },
  { value: "nomina", label: "Nómina" },
  { value: "promociones", label: "Descuentos y promociones" },
  { value: "insights", label: "Panel de control / Insights" },
];

export function DetallesLead({
  leadId,
  valorEstimado,
  prioridad,
  fechaLead,
  origen,
  modulosInteres,
  serviciosDisponibles,
  responsableNombre,
  responsables,
}: {
  leadId: string;
  valorEstimado: number | null;
  prioridad: number | null;
  fechaLead: string;
  origen: string | null;
  modulosInteres: string[];
  serviciosDisponibles: { value: string; label: string }[] | null;
  responsableNombre: string | null;
  responsables: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [valorTexto, setValorTexto] = useState(valorEstimado != null ? String(valorEstimado) : "");
  const [valorEstimadoLocal, setValorEstimadoLocal] = useState(valorEstimado);
  const [prioridadLocal, setPrioridadLocal] = useState(prioridad);
  const [modulosLocal, setModulosLocal] = useState(modulosInteres);
  const [responsableLocal, setResponsableLocal] = useState(responsableNombre);
  const [guardandoValor, setGuardandoValor] = useState(false);
  const [guardandoPrioridad, setGuardandoPrioridad] = useState(false);
  const [guardandoModulos, setGuardandoModulos] = useState(false);
  const [guardandoResponsable, setGuardandoResponsable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada acción actualiza el estado local de inmediato (optimista) y solo
  // revierte si el servidor responde con error — así el cambio se ve al
  // instante en vez de esperar a que termine el viaje al servidor.
  async function guardarValor() {
    const numero = valorTexto.trim() ? Number(valorTexto) : null;
    if (valorTexto.trim() && Number.isNaN(numero)) return;
    const anterior = valorEstimadoLocal;
    setGuardandoValor(true);
    const resultado = await actualizarValorEstimadoLead(leadId, numero, anterior);
    if (resultado.error) setError(resultado.error);
    else setValorEstimadoLocal(numero);
    setGuardandoValor(false);
    router.refresh();
  }

  async function cambiarPrioridad(valor: number | null) {
    const anterior = prioridadLocal;
    setPrioridadLocal(valor);
    setGuardandoPrioridad(true);
    const resultado = await actualizarPrioridadLead(leadId, valor, anterior);
    if (resultado.error) {
      setError(resultado.error);
      setPrioridadLocal(anterior);
    }
    setGuardandoPrioridad(false);
    router.refresh();
  }

  async function cambiarModulos(valores: string[]) {
    const anterior = modulosLocal;
    setModulosLocal(valores);
    setGuardandoModulos(true);
    const resultado = await actualizarModulosInteresLead(leadId, valores);
    if (resultado.error) {
      setError(resultado.error);
      setModulosLocal(anterior);
    }
    setGuardandoModulos(false);
    router.refresh();
  }

  async function cambiarResponsable(id: string | null) {
    const anterior = responsableLocal;
    const nuevoNombre = id ? (responsables.find((r) => r.id === id)?.nombre ?? null) : null;
    setResponsableLocal(nuevoNombre);
    setGuardandoResponsable(true);
    const resultado = await actualizarResponsableLead(leadId, id, anterior, nuevoNombre);
    if (resultado.error) {
      setError(resultado.error);
      setResponsableLocal(anterior);
    }
    setGuardandoResponsable(false);
    router.refresh();
  }

  async function crearYAsignarResponsable(nombre: string) {
    const anterior = responsableLocal;
    setGuardandoResponsable(true);
    const resultado = await crearResponsableLead(nombre);
    if (resultado.error || !resultado.id) {
      if (resultado.error) setError(resultado.error);
      setGuardandoResponsable(false);
      return;
    }
    setResponsableLocal(nombre);
    const resultado2 = await actualizarResponsableLead(leadId, resultado.id, anterior, nombre);
    if (resultado2.error) {
      setError(resultado2.error);
      setResponsableLocal(anterior);
    }
    setGuardandoResponsable(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <h2 className="mb-4 text-sm font-semibold text-gray-900">Detalles del lead</h2>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-400">Valor estimado</span>
          <div className="flex items-center gap-1.5">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              className="h-3.5 w-3.5 text-gray-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v18M17 7.5c0-1.93-2.24-3.5-5-3.5s-5 1.57-5 3.5 2.24 3.5 5 3.5 5 1.57 5 3.5-2.24 3.5-5 3.5-5-1.57-5-3.5"
              />
            </svg>
            <input
              value={valorTexto}
              onChange={(e) => setValorTexto(e.target.value.replace(/[^\d]/g, ""))}
              onBlur={guardarValor}
              disabled={guardandoValor}
              placeholder="Sin definir"
              className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-gray-500 focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-400">Prioridad</span>
          <PrioridadSelector
            valor={prioridadLocal}
            onChange={cambiarPrioridad}
            deshabilitado={guardandoPrioridad}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-400">Fecha de lead</span>
          <span className="text-gray-700">{new Date(fechaLead).toLocaleDateString("es-CO")}</span>
        </div>

        {origen && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-gray-400">Vino de</span>
            <span className="text-gray-700">{origen}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-400">Módulos de interés</span>
          <MultiSelector
            opciones={serviciosDisponibles ?? MODULOS_DATUM}
            seleccionados={modulosLocal}
            onChange={cambiarModulos}
            deshabilitado={guardandoModulos}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-400">Responsable</span>
          <ResponsableSelector
            responsables={responsables}
            nombreActual={responsableLocal}
            guardando={guardandoResponsable}
            onSeleccionar={cambiarResponsable}
            onCrear={crearYAsignarResponsable}
          />
        </div>
      </div>
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  );
}
