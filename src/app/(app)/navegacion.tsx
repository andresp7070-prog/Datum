"use client";

import { createContext, useContext, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type NavegacionContexto = {
  navegando: boolean;
  navegar: (href: string) => void;
};

const Contexto = createContext<NavegacionContexto | null>(null);

// startTransition es lo que evita que Next reemplace de golpe la pantalla
// actual por loading.tsx: mientras la transición está pendiente, React deja
// visible lo que ya estaba mientras arma la ruta nueva atrás.
export function NavegacionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [navegando, startTransition] = useTransition();

  const navegar = (href: string) => {
    startTransition(() => {
      router.push(href);
    });
  };

  return <Contexto.Provider value={{ navegando, navegar }}>{children}</Contexto.Provider>;
}

export function useNavegacion() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useNavegacion debe usarse dentro de NavegacionProvider");
  return ctx;
}
