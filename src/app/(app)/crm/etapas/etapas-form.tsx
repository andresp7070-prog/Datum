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
  crearCampoEtapa,
  borrarCampoEtapa,
  crearCampoGeneral,
  borrarCampoGeneral,
} from "./actions";

type Etapa = {
  id: string;
  nombre: string;
  orden: number;
  es_cierre: boolean;
  dias_inactividad: number | null;
  etapa_destino_inactividad_id: string | null;
};

export type CampoEtapa = {
  id: string;
  etapa_id: string;
  nombre: string;
  tipo: "texto" | "numero" | "fecha" | "si_no" | "seleccion" | "enlace";
  opciones: string[] | null;
  requerido: boolean;
};

export type CampoGeneral = {
  id: string;
  nombre: string;
  tipo: "texto" | "numero" | "fecha" | "si_no" | "seleccion" | "enlace";
  opciones: string[] | null;
  requerido: boolean;
};

const tiposCampo = [
  { value: "texto", label: "Texto" },
  { value: "numero", label: "Número" },
  { value: "fecha", label: "Fecha" },
  { value: "si_no", label: "Sí / No" },
  { value: "seleccion", label: "Selección (opciones)" },
  { value: "enlace", label: "Enlace (archivo de Drive, etc.)" },
];

function CamposEtapaConfig({ etapaId, campos }: { etapaId: string; campos: CampoEtapa[] }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<CampoEtapa["tipo"]>("texto");
  const [opciones, setOpciones] = useState("");
  const [requerido, setRequerido] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  async function agregar() {
    setError(null);
    setGuardando(true);
    const resultado = await crearCampoEtapa({
      etapaId,
      nombre,
      tipo,
      opciones: opciones
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
      requerido,
    });
    setGuardando(false);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    setNombre("");
    setTipo("texto");
    setOpciones("");
    setRequerido(false);
    router.refresh();
  }

  async function borrar(campoId: string) {
    setBorrandoId(campoId);
    await borrarCampoEtapa(campoId);
    setBorrandoId(null);
    router.refresh();
  }

  return (
    <div className="mt-3 rounded-lg bg-gray-50 px-3 py-3 text-sm">
      <p className="mb-2 text-xs font-medium text-gray-700">Campos que se piden en esta etapa</p>
      {campos.length === 0 ? (
        <p className="mb-3 text-xs text-gray-400">Todavía no hay campos definidos.</p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {campos.map((campo) => (
            <li key={campo.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-gray-700">
                {campo.nombre}
                <span className="text-gray-400">
                  {" "}
                  · {tiposCampo.find((t) => t.value === campo.tipo)?.label ?? campo.tipo}
                  {campo.requerido ? " · obligatorio" : ""}
                  {campo.opciones && campo.opciones.length > 0 ? ` · ${campo.opciones.join(", ")}` : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => borrar(campo.id)}
                disabled={borrandoId === campo.id}
                className="shrink-0 text-gray-400 hover:text-red-600 disabled:opacity-50"
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre del campo"
          className="w-40 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-gray-500 focus:outline-none"
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as CampoEtapa["tipo"])}
          className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-gray-500 focus:outline-none"
        >
          {tiposCampo.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {tipo === "seleccion" && (
          <input
            value={opciones}
            onChange={(e) => setOpciones(e.target.value)}
            placeholder="Opciones separadas por coma"
            className="w-48 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-gray-500 focus:outline-none"
          />
        )}
        <label className="flex items-center gap-1 text-xs text-gray-600">
          <input type="checkbox" checked={requerido} onChange={(e) => setRequerido(e.target.checked)} />
          Obligatorio
        </label>
        <button
          type="button"
          onClick={agregar}
          disabled={guardando}
          className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          Agregar campo
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function CamposGeneralesConfig({ campos }: { campos: CampoGeneral[] }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<CampoGeneral["tipo"]>("texto");
  const [opciones, setOpciones] = useState("");
  const [requerido, setRequerido] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  async function agregar() {
    setError(null);
    setGuardando(true);
    const resultado = await crearCampoGeneral({
      nombre,
      tipo,
      opciones: opciones
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
      requerido,
    });
    setGuardando(false);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    setNombre("");
    setTipo("texto");
    setOpciones("");
    setRequerido(false);
    router.refresh();
  }

  async function borrar(campoId: string) {
    setBorrandoId(campoId);
    await borrarCampoGeneral(campoId);
    setBorrandoId(null);
    router.refresh();
  }

  return (
    <div className="mb-6 rounded-xl border border-gray-200 p-4">
      <h2 className="mb-1 text-sm font-semibold text-gray-900">Campos generales</h2>
      <p className="mb-3 text-xs text-gray-500">
        Se piden para todos los clientes, sin importar en qué etapa estén — a diferencia de los
        campos de cada etapa, estos no dependen de dónde va el contacto en el embudo.
      </p>
      {campos.length === 0 ? (
        <p className="mb-3 text-xs text-gray-400">Todavía no hay campos generales definidos.</p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {campos.map((campo) => (
            <li key={campo.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-gray-700">
                {campo.nombre}
                <span className="text-gray-400">
                  {" "}
                  · {tiposCampo.find((t) => t.value === campo.tipo)?.label ?? campo.tipo}
                  {campo.requerido ? " · obligatorio" : ""}
                  {campo.opciones && campo.opciones.length > 0 ? ` · ${campo.opciones.join(", ")}` : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => borrar(campo.id)}
                disabled={borrandoId === campo.id}
                className="shrink-0 text-gray-400 hover:text-red-600 disabled:opacity-50"
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre del campo"
          className="w-40 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-gray-500 focus:outline-none"
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as CampoGeneral["tipo"])}
          className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-gray-500 focus:outline-none"
        >
          {tiposCampo.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {tipo === "seleccion" && (
          <input
            value={opciones}
            onChange={(e) => setOpciones(e.target.value)}
            placeholder="Opciones separadas por coma"
            className="w-48 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-gray-500 focus:outline-none"
          />
        )}
        <label className="flex items-center gap-1 text-xs text-gray-600">
          <input type="checkbox" checked={requerido} onChange={(e) => setRequerido(e.target.checked)} />
          Obligatorio
        </label>
        <button
          type="button"
          onClick={agregar}
          disabled={guardando}
          className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          Agregar campo
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function EtapaFila({
  etapa,
  etapas,
  campos,
  esPrimera,
  esUltima,
}: {
  etapa: Etapa;
  etapas: Etapa[];
  campos: CampoEtapa[];
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
  const [mostrarCampos, setMostrarCampos] = useState(false);

  const opcionesDestino = etapas.filter((e) => e.id !== etapa.id);
  const camposDeEtapa = campos.filter((c) => c.etapa_id === etapa.id);

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

        <button
          type="button"
          onClick={() => setMostrarCampos((v) => !v)}
          className="shrink-0 text-xs text-gray-500 hover:text-gray-700"
        >
          {camposDeEtapa.length > 0 ? `Campos (${camposDeEtapa.length})` : "+ Campos de esta etapa"}
        </button>
      </div>

      {mostrarCampos && <CamposEtapaConfig etapaId={etapa.id} campos={camposDeEtapa} />}

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

export function EtapasForm({
  etapas,
  campos,
  camposGenerales,
}: {
  etapas: Etapa[];
  campos: CampoEtapa[];
  camposGenerales: CampoGeneral[];
}) {
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

      <CamposGeneralesConfig campos={camposGenerales} />

      <ul className="mb-6 divide-y divide-gray-200 rounded-xl border border-gray-200">
        {etapas.map((etapa, indice) => (
          <EtapaFila
            key={etapa.id}
            etapa={etapa}
            etapas={etapas}
            campos={campos}
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
