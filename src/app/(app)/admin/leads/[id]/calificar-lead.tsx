"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Estrellas } from "@/app/(app)/crm/estrellas";
import { calificarLead } from "./actions";

export function CalificarLead({
  leadId,
  calificacionInicial,
}: {
  leadId: string;
  calificacionInicial: number | null;
}) {
  const router = useRouter();
  const [calificacion, setCalificacion] = useState(calificacionInicial);
  const [guardando, setGuardando] = useState(false);

  async function onChange(valor: number | null) {
    setCalificacion(valor);
    setGuardando(true);
    await calificarLead(leadId, valor);
    setGuardando(false);
    router.refresh();
  }

  return (
    <div className={guardando ? "opacity-50" : ""}>
      <Estrellas valor={calificacion} onChange={onChange} tamano="md" />
    </div>
  );
}
