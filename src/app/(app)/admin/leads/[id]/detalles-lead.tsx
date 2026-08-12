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

// Datum no vende inventario propio, así que en vez de un catálogo de
// productos se usa la misma lista de módulos del producto — son
// servicios sin insumos ni receta, no tiene sentido modelarlos como
// inventario_items con costo $0.
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
  modulosInteres,
  responsableNombre,
  responsables,
}: {
  leadId: string;
  valorEstimado: number | null;
  prioridad: number | null;
  fechaLead: string;
  modulosInteres: string[];
  responsableNombre: string | null;
  responsables: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [valorTexto, setValorTexto] = useState(valorEstimado != null ? String(valorEstimado) : "");
  const [guardandoValor, setGuardandoValor] = useState(false);
  const [guardandoPrioridad, setGuardandoPrioridad] = useState(false);
  const [guardandoModulos, setGuardandoModulos] = useState(false);
  const [guardandoResponsable, setGuardandoResponsable] = useState(false);

  async function guardarValor() {
    const numero = valorTexto.trim() ? Number(valorTexto) : null;
    if (valorTexto.trim() && Number.isNaN(numero)) return;
    setGuardandoValor(true);
    await actualizarValorEstimadoLead(leadId, numero);
    setGuardandoValor(false);
    router.refresh();
  }

  async function cambiarPrioridad(valor: number | null) {
    setGuardandoPrioridad(true);
    await actualizarPrioridadLead(leadId, valor);
    setGuardandoPrioridad(false);
    router.refresh();
  }

  async function cambiarModulos(valores: string[]) {
    setGuardandoModulos(true);
    await actualizarModulosInteresLead(leadId, valores);
    setGuardandoModulos(false);
    router.refresh();
  }

  async function cambiarResponsable(id: string | null) {
    setGuardandoResponsable(true);
    await actualizarResponsableLead(leadId, id);
    setGuardandoResponsable(false);
    router.refresh();
  }

  async function crearYAsignarResponsable(nombre: string) {
    setGuardandoResponsable(true);
    const resultado = await crearResponsableLead(nombre);
    if (resultado.id) await actualizarResponsableLead(leadId, resultado.id);
    setGuardandoResponsable(false);
    router.refresh();
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-xs">
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
          placeholder="Valor estimado"
          className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-gray-500 focus:outline-none disabled:opacity-50"
        />
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-gray-400">Prioridad</span>
        <PrioridadSelector valor={prioridad} onChange={cambiarPrioridad} deshabilitado={guardandoPrioridad} />
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-gray-400">Fecha de lead</span>
        <span className="text-gray-700">{new Date(fechaLead).toLocaleDateString("es-CO")}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-gray-400">Módulos de interés</span>
        <MultiSelector
          opciones={MODULOS_DATUM}
          seleccionados={modulosInteres}
          onChange={cambiarModulos}
          deshabilitado={guardandoModulos}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-gray-400">Responsable</span>
        <ResponsableSelector
          responsables={responsables}
          nombreActual={responsableNombre}
          guardando={guardandoResponsable}
          onSeleccionar={cambiarResponsable}
          onCrear={crearYAsignarResponsable}
        />
      </div>
    </div>
  );
}
