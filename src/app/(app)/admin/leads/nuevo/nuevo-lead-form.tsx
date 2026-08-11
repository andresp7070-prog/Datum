"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { crearLead } from "./actions";

type Campo = {
  id: string;
  nombre: string;
  tipo: "texto" | "numero" | "fecha" | "si_no" | "seleccion" | "enlace";
  opciones: string[] | null;
};

type ValorCampo = string | boolean | { nombre: string; url: string } | null;

function CampoObligatorio({
  campo,
  valor,
  onChange,
}: {
  campo: Campo;
  valor: ValorCampo;
  onChange: (valor: ValorCampo) => void;
}) {
  if (campo.tipo === "si_no") {
    return (
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={Boolean(valor)} onChange={(e) => onChange(e.target.checked)} />
        {valor ? "Sí" : "No"}
      </label>
    );
  }

  if (campo.tipo === "seleccion") {
    return (
      <select
        value={typeof valor === "string" ? valor : ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
      >
        <option value="">Sin elegir</option>
        {(campo.opciones ?? []).map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>
    );
  }

  if (campo.tipo === "enlace") {
    const valorEnlace = valor && typeof valor === "object" ? valor : { nombre: "", url: "" };
    return (
      <div className="flex flex-col gap-1.5 sm:flex-row">
        <input
          value={valorEnlace.nombre}
          onChange={(e) => onChange({ nombre: e.target.value, url: valorEnlace.url })}
          placeholder="Nombre del archivo"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <input
          value={valorEnlace.url}
          onChange={(e) => onChange({ nombre: valorEnlace.nombre, url: e.target.value })}
          placeholder="Enlace (URL)"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
      </div>
    );
  }

  return (
    <input
      type={campo.tipo === "numero" ? "number" : campo.tipo === "fecha" ? "date" : "text"}
      value={typeof valor === "string" ? valor : ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
    />
  );
}

function campoEstaVacio(valor: ValorCampo, tipo: Campo["tipo"]): boolean {
  if (tipo === "si_no") return false;
  if (tipo === "enlace") return !valor || typeof valor !== "object" || !valor.nombre.trim() || !valor.url.trim();
  return valor === null || valor === undefined || (typeof valor === "string" && !valor.trim());
}

export function NuevoLeadForm({ camposObligatorios }: { camposObligatorios: Campo[] }) {
  const router = useRouter();

  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [valoresCampos, setValoresCampos] = useState<Record<string, ValorCampo>>({});

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function actualizarCampo(campoId: string, valor: ValorCampo) {
    setValoresCampos((prev) => ({ ...prev, [campoId]: valor }));
  }

  async function guardar() {
    setError(null);

    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    const campoFaltante = camposObligatorios.find((campo) =>
      campoEstaVacio(valoresCampos[campo.id] ?? null, campo.tipo),
    );
    if (campoFaltante) {
      setError(`El campo "${campoFaltante.nombre}" es obligatorio.`);
      return;
    }

    setGuardando(true);
    try {
      const resultado = await crearLead({
        nombre: nombre.trim(),
        empresa: empresa.trim(),
        telefono: telefono.trim(),
        email: email.trim(),
        camposValores: valoresCampos,
      });
      if (resultado.error || !resultado.id) {
        setError(resultado.error ?? "No se pudo crear el lead.");
        setGuardando(false);
        return;
      }
      router.push(`/admin/leads/${resultado.id}?creado=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el lead.");
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-md">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Agregar lead</h1>
        <Link href="/admin/leads" className="text-sm text-gray-500 hover:text-gray-700">
          Volver
        </Link>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Nombre de contacto *
          </label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Empresa (opcional)
          </label>
          <input
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Teléfono (opcional)
          </label>
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ""))}
            type="tel"
            inputMode="numeric"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Correo (opcional)
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        {camposObligatorios.map((campo) => (
          <div key={campo.id}>
            <label className="mb-1 block text-sm font-medium text-gray-700">{campo.nombre} *</label>
            <CampoObligatorio
              campo={campo}
              valor={valoresCampos[campo.id] ?? null}
              onChange={(valor) => actualizarCampo(campo.id, valor)}
            />
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-gray-400">* Campos obligatorios</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "Guardar lead"}
      </button>
    </div>
  );
}
