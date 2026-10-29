"use client";

import { useState, useTransition } from "react";
import { conectarBancolombia } from "./actions";

export function FormularioBancolombia({
  permalinkTerminos,
  permalinkDatosPersonales,
}: {
  permalinkTerminos: string;
  permalinkDatosPersonales: string;
}) {
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaDatos, setAceptaDatos] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const listoParaConectar = aceptaTerminos && aceptaDatos;

  return (
    <div>
      <div className="mb-5 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={aceptaTerminos}
            onChange={(e) => setAceptaTerminos(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Leí y acepto los{" "}
            <a
              href={permalinkTerminos}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Términos y condiciones de Wompi
            </a>
            , la pasarela de pago que procesa tu cuenta.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={aceptaDatos}
            onChange={(e) => setAceptaDatos(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Autorizo el{" "}
            <a
              href={permalinkDatosPersonales}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              tratamiento de mis datos personales
            </a>{" "}
            por parte de Wompi.
          </span>
        </label>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        disabled={!listoParaConectar || pendiente}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const resultado = await conectarBancolombia();
            if (!resultado.ok) {
              setError(resultado.error);
              return;
            }
            window.location.href = resultado.authorizationUrl;
          });
        }}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
      >
        {pendiente ? "Conectando..." : "Conectar con Bancolombia"}
      </button>
      <p className="mt-3 text-center text-xs text-gray-400">
        Te llevamos a la página de Bancolombia para que autorices tu cuenta. Al terminar, vuelves
        aquí solo.
      </p>
    </div>
  );
}
