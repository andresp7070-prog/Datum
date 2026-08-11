"use client";

import { useState } from "react";
import { guardarCampoValorLead } from "./actions";

type CampoEtapa = {
  id: string;
  etapa_id: string | null;
  nombre: string;
  tipo: "texto" | "numero" | "fecha" | "si_no" | "seleccion" | "enlace";
  opciones: string[] | null;
  requerido: boolean;
};

type ValorEnlace = { nombre: string; url: string };
type Valores = Record<string, string | boolean | ValorEnlace | null>;

function CampoInput({
  campo,
  valor,
  onGuardado,
}: {
  campo: CampoEtapa;
  valor: string | boolean | ValorEnlace | null | undefined;
  onGuardado: (campoId: string, valor: string | boolean | ValorEnlace | null) => void;
}) {
  const valorEnlace = valor && typeof valor === "object" ? (valor as ValorEnlace) : null;
  const [valorLocal, setValorLocal] = useState<string | boolean | null>(
    campo.tipo === "enlace" ? "" : (valor as string | boolean | null) ?? (campo.tipo === "si_no" ? false : ""),
  );
  const [nombreEnlace, setNombreEnlace] = useState(valorEnlace?.nombre ?? "");
  const [urlEnlace, setUrlEnlace] = useState(valorEnlace?.url ?? "");
  const [guardando, setGuardando] = useState(false);

  async function guardar(nuevoValor: string | boolean | ValorEnlace | null) {
    setValorLocal(typeof nuevoValor === "object" ? valorLocal : nuevoValor);
    setGuardando(true);
    onGuardado(campo.id, nuevoValor);
    setGuardando(false);
  }

  async function guardarEnlace(nombre: string, url: string) {
    if (!nombre.trim() && !url.trim()) {
      await guardar(null);
      return;
    }
    await guardar({ nombre: nombre.trim(), url: url.trim() });
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">
        {campo.nombre}
        {campo.requerido ? " *" : ""}
      </label>
      {campo.tipo === "si_no" ? (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={Boolean(valorLocal)}
            disabled={guardando}
            onChange={(e) => guardar(e.target.checked)}
          />
          {valorLocal ? "Sí" : "No"}
        </label>
      ) : campo.tipo === "seleccion" ? (
        <select
          value={typeof valorLocal === "string" ? valorLocal : ""}
          disabled={guardando}
          onChange={(e) => guardar(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none disabled:opacity-50"
        >
          <option value="">Sin elegir</option>
          {(campo.opciones ?? []).map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
      ) : campo.tipo === "enlace" ? (
        <div className="space-y-1.5">
          <div className="flex flex-col gap-1.5 sm:flex-row">
            <input
              value={nombreEnlace}
              onChange={(e) => setNombreEnlace(e.target.value)}
              onBlur={() => guardarEnlace(nombreEnlace, urlEnlace)}
              disabled={guardando}
              placeholder="Nombre del archivo"
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none disabled:opacity-50"
            />
            <input
              value={urlEnlace}
              onChange={(e) => setUrlEnlace(e.target.value)}
              onBlur={() => guardarEnlace(nombreEnlace, urlEnlace)}
              disabled={guardando}
              placeholder="Enlace (URL de Drive, etc.)"
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none disabled:opacity-50"
            />
          </div>
          {valorEnlace?.url && (
            <a
              href={valorEnlace.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              📎 {valorEnlace.nombre || "Ver archivo"}
            </a>
          )}
        </div>
      ) : (
        <input
          type={campo.tipo === "numero" ? "number" : campo.tipo === "fecha" ? "date" : "text"}
          value={typeof valorLocal === "string" ? valorLocal : ""}
          disabled={guardando}
          onChange={(e) => setValorLocal(e.target.value)}
          onBlur={(e) => guardar(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none disabled:opacity-50"
        />
      )}
    </div>
  );
}

export function CamposAdicionales({
  leadId,
  campos,
  valores,
}: {
  leadId: string;
  campos: CampoEtapa[];
  valores: Valores;
}) {
  const [valoresLocales, setValoresLocales] = useState<Valores>(valores);
  const [error, setError] = useState<string | null>(null);

  if (campos.length === 0) return null;

  async function onGuardado(campoId: string, valor: string | boolean | ValorEnlace | null) {
    setError(null);
    setValoresLocales((prev) => ({ ...prev, [campoId]: valor }));
    const resultado = await guardarCampoValorLead({ leadId, campoId, valor });
    if (resultado.error) setError(resultado.error);
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <h2 className="mb-4 text-sm font-semibold text-gray-900">Información adicional</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {campos.map((campo) => (
          <CampoInput
            key={campo.id}
            campo={campo}
            valor={valoresLocales[campo.id]}
            onGuardado={onGuardado}
          />
        ))}
      </div>
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  );
}
