"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  crearEtapa,
  renombrarEtapa,
  moverEtapa,
  marcarEtapaCierre,
  actualizarReglaInactividad,
} from "./actions";

type Etapa = {
  id: string;
  nombre: string;
  orden: number;
  es_cierre: boolean;
  dias_inactividad: number | null;
  etapa_destino_inactividad_id: string | null;
};

function EtapaFila({
  etapa,
  etapas,
  esPrimera,
  esUltima,
}: {
  etapa: Etapa;
  etapas: Etapa[];
  esPrimera: boolean;
  esUltima: boolean;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(etapa.nombre);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mostrarRegla, setMostrarRegla] = useState(Boolean(etapa.dias_inactividad));
  const [dias, setDias] = useState(etapa.dias_inactividad?.toString() ?? "");
  const [destino, setDestino] = useState(etapa.etapa_destino_inactividad_id ?? "");

  const opcionesDestino = etapas.filter((e) => e.id !== etapa.id);

  async function guardarNombre() {
    if (nombre.trim() === etapa.nombre) return;
    setError(null);
    setGuardando(true);
    const resultado = await renombrarEtapa(etapa.id, nombre);
    setGuardando(false);
    if (resultado.error) {
      setError(resultado.error);
      setNombre(etapa.nombre);
      return;
    }
    router.refresh();
  }

  async function mover(direccion: "arriba" | "abajo") {
    setGuardando(true);
    await moverEtapa(etapa.id, direccion);
    setGuardando(false);
    router.refresh();
  }

  async function marcarCierre() {
    setGuardando(true);
    await marcarEtapaCierre(etapa.id);
    setGuardando(false);
    router.refresh();
  }

  async function guardarRegla() {
    setError(null);
    const diasNum = Number(dias);
    if (!dias.trim() || Number.isNaN(diasNum) || diasNum <= 0) {
      setError("Escribe cuántos días de inactividad, mayor a cero.");
      return;
    }
    if (!destino) {
      setError("Elige a qué etapa se mueve.");
      return;
    }
    setGuardando(true);
    const resultado = await actualizarReglaInactividad({
      etapaId: etapa.id,
      diasInactividad: diasNum,
      etapaDestinoId: destino,
    });
    setGuardando(false);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  async function quitarRegla() {
    setGuardando(true);
    await actualizarReglaInactividad({ etapaId: etapa.id, diasInactividad: null, etapaDestinoId: null });
    setGuardando(false);
    setMostrarRegla(false);
    setDias("");
    setDestino("");
    router.refresh();
  }

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => mover("arriba")}
            disabled={esPrimera || guardando}
            className="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
            aria-label="Mover arriba"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => mover("abajo")}
            disabled={esUltima || guardando}
            className="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
            aria-label="Mover abajo"
          >
            ▼
          </button>
        </div>

        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={guardarNombre}
          disabled={guardando}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none disabled:opacity-50"
        />

        <label className="flex shrink-0 items-center gap-1.5 text-xs text-gray-500">
          <input
            type="radio"
            name="etapa-cierre"
            checked={etapa.es_cierre}
            onChange={marcarCierre}
            disabled={guardando}
          />
          Etapa de cierre
        </label>

        <button
          type="button"
          onClick={() => setMostrarRegla((v) => !v)}
          className="shrink-0 text-xs text-gray-500 hover:text-gray-700"
        >
          {etapa.dias_inactividad ? "Regla de inactividad ✓" : "+ Regla de inactividad"}
        </button>
      </div>

      {mostrarRegla && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
          <span className="text-gray-600">Si pasan</span>
          <input
            type="number"
            min={1}
            value={dias}
            onChange={(e) => setDias(e.target.value)}
            className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-gray-500 focus:outline-none"
          />
          <span className="text-gray-600">días sin ninguna interacción, mover a</span>
          <select
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-gray-500 focus:outline-none"
          >
            <option value="">Elige una etapa...</option>
            {opcionesDestino.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={guardarRegla}
            disabled={guardando}
            className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Guardar regla
          </button>
          {etapa.dias_inactividad && (
            <button
              type="button"
              onClick={quitarRegla}
              disabled={guardando}
              className="text-xs text-gray-500 hover:text-red-600"
            >
              Quitar regla
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </li>
  );
}

export function EtapasForm({ etapas }: { etapas: Etapa[] }) {
  const router = useRouter();
  const [nuevaEtapa, setNuevaEtapa] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function agregar() {
    setError(null);
    if (!nuevaEtapa.trim()) {
      setError("Escribe un nombre para la etapa.");
      return;
    }
    setGuardando(true);
    const resultado = await crearEtapa(nuevaEtapa);
    setGuardando(false);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    setNuevaEtapa("");
    router.refresh();
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Configurar etapas del CRM</h1>
        <Link href="/crm" className="text-sm text-gray-500 hover:text-gray-700">
          Volver al CRM
        </Link>
      </div>

      <p className="mb-6 text-sm text-gray-500">
        Estas son las etapas del embudo de tus clientes. Puedes agregar las que necesites,
        cambiarles el nombre y reordenarlas. La etapa marcada como &ldquo;de cierre&rdquo; es a la
        que cae un contacto automáticamente en cuanto se le registra una venta — solo puede haber
        una. La regla de inactividad, opcional, mueve solo a un contacto que lleva mucho tiempo sin
        seguimiento (se revisa cada vez que alguien abre el CRM, no al instante).
      </p>

      <ul className="mb-6 divide-y divide-gray-200 rounded-xl border border-gray-200">
        {etapas.map((etapa, indice) => (
          <EtapaFila
            key={etapa.id}
            etapa={etapa}
            etapas={etapas}
            esPrimera={indice === 0}
            esUltima={indice === etapas.length - 1}
          />
        ))}
      </ul>

      <div className="flex items-center gap-2">
        <input
          value={nuevaEtapa}
          onChange={(e) => setNuevaEtapa(e.target.value)}
          placeholder="Nombre de la etapa nueva"
          className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={agregar}
          disabled={guardando}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          Agregar etapa
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
