"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Estrellas } from "../estrellas";
import { calificarCliente } from "./actions";

export function CalificarCliente({
  contactoId,
  calificacionInicial,
}: {
  contactoId: string;
  calificacionInicial: number | null;
}) {
  const router = useRouter();
  const [calificacion, setCalificacion] = useState(calificacionInicial);
  const [guardando, setGuardando] = useState(false);

  async function onChange(valor: number | null) {
    setCalificacion(valor);
    setGuardando(true);
    await calificarCliente(contactoId, valor);
    setGuardando(false);
    router.refresh();
  }

  return (
    <div className={guardando ? "opacity-50" : ""}>
      <Estrellas valor={calificacion} onChange={onChange} tamano="md" />
    </div>
  );
}
