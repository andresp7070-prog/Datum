"use client";

import { useFormStatus } from "react-dom";

// Estado "Esperando" de Oficina Datum (tablero Esperando.dc.html): mismo
// color que ya usábamos para hover (bg-accent-hover), misma aguja girando
// que loading.tsx, mismo texto "Entrando…". Se deshabilita mientras
// pending para no poder mandar el formulario dos veces.
export function BotonEntrar() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-accent-hover"
    >
      {pending ? (
        <>
          <svg viewBox="0 0 48 48" fill="none" className="h-[17px] w-[17px] shrink-0" aria-hidden="true">
            <path d="M 24 42 A 18 18 0 1 1 36.321 37.122" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            <path className="aguja-girando" d="M24 10 L29 24 L24 38 L19 24 Z" fill="currentColor" />
          </svg>
          Entrando…
        </>
      ) : (
        "Entrar"
      )}
    </button>
  );
}
