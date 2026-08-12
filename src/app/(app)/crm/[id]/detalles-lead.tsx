"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrioridadSelector } from "../prioridad";
import { ResponsableSelector } from "../responsable-selector";
import { MultiSelector } from "../multi-selector";
import {
  actualizarValorEstimado,
  actualizarPrioridad,
  actualizarProductosInteres,
  actualizarResponsable,
  crearResponsable,
} from "./actions";

export function DetallesLead({
  contactoId,
  valorEstimado,
  prioridad,
  fechaLead,
  productosInteres,
  itemsDisponibles,
  responsableNombre,
  responsables,
}: {
  contactoId: string;
  valorEstimado: number | null;
  prioridad: number | null;
  fechaLead: string;
  productosInteres: string[];
  itemsDisponibles: { value: string; label: string }[] | null;
  responsableNombre: string | null;
  responsables: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [valorTexto, setValorTexto] = useState(valorEstimado != null ? String(valorEstimado) : "");
  const [guardandoValor, setGuardandoValor] = useState(false);
  const [guardandoPrioridad, setGuardandoPrioridad] = useState(false);
  const [guardandoProductos, setGuardandoProductos] = useState(false);
  const [guardandoResponsable, setGuardandoResponsable] = useState(false);

  async function guardarValor() {
    const numero = valorTexto.trim() ? Number(valorTexto) : null;
    if (valorTexto.trim() && Number.isNaN(numero)) return;
    setGuardandoValor(true);
    await actualizarValorEstimado(contactoId, numero);
    setGuardandoValor(false);
    router.refresh();
  }

  async function cambiarPrioridad(valor: number | null) {
    setGuardandoPrioridad(true);
    await actualizarPrioridad(contactoId, valor);
    setGuardandoPrioridad(false);
    router.refresh();
  }

  async function cambiarProductos(valores: string[]) {
    setGuardandoProductos(true);
    await actualizarProductosInteres(contactoId, valores);
    setGuardandoProductos(false);
    router.refresh();
  }

  async function cambiarResponsable(id: string | null) {
    setGuardandoResponsable(true);
    await actualizarResponsable(contactoId, id);
    setGuardandoResponsable(false);
    router.refresh();
  }

  async function crearYAsignarResponsable(nombre: string) {
    setGuardandoResponsable(true);
    const resultado = await crearResponsable(nombre);
    if (resultado.id) await actualizarResponsable(contactoId, resultado.id);
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M17 7.5c0-1.93-2.24-3.5-5-3.5s-5 1.57-5 3.5 2.24 3.5 5 3.5 5 1.57 5 3.5-2.24 3.5-5 3.5-5-1.57-5-3.5" />
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
          <PrioridadSelector valor={prioridad} onChange={cambiarPrioridad} deshabilitado={guardandoPrioridad} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-400">Fecha de lead</span>
          <span className="text-gray-700">{new Date(fechaLead).toLocaleDateString("es-CO")}</span>
        </div>

        {itemsDisponibles && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-gray-400">Productos de interés</span>
            <MultiSelector
              opciones={itemsDisponibles}
              seleccionados={productosInteres}
              onChange={cambiarProductos}
              deshabilitado={guardandoProductos}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
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
    </div>
  );
}
