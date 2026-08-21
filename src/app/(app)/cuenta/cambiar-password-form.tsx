"use client";

import { useState } from "react";
import { cambiarPassword } from "./actions";

// Colapsado por defecto — antes el formulario completo (dos campos +
// aviso + botón) quedaba siempre expuesto en la pantalla de "Mi cuenta",
// aunque casi nadie lo usa seguido. Si viene un error (falló un intento
// anterior), arranca expandido para que se vea en contexto en vez de
// esconder el mensaje detrás de un clic.
export function CambiarPasswordForm({ error }: { error?: string }) {
  const [mostrar, setMostrar] = useState(Boolean(error));

  if (!mostrar) {
    return (
      <button
        type="button"
        onClick={() => setMostrar(true)}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Cambiar contraseña
      </button>
    );
  }

  return (
    <>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form action={cambiarPassword} className="space-y-4">
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
            Contraseña nueva
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="confirmar" className="mb-1 block text-sm font-medium text-gray-700">
            Confirmar contraseña nueva
          </label>
          <input
            id="confirmar"
            name="confirmar"
            type="password"
            required
            minLength={6}
            className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <p className="text-xs text-gray-400">
          Al guardar, se cierra la sesión en este dispositivo y hay que iniciar sesión de nuevo con
          la contraseña nueva.
        </p>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Guardar y cerrar sesión
          </button>
          <button
            type="button"
            onClick={() => setMostrar(false)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancelar
          </button>
        </div>
      </form>
    </>
  );
}
