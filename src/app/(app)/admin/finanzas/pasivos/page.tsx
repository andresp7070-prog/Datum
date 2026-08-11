import { requerirAdmin } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import { DirectorioPasivos } from "./directorio-pasivos";

export default async function PasivosDatumPage() {
  await requerirAdmin();
  const supabase = await createClient();

  const { data: pasivos } = await supabase
    .from("datum_pasivos")
    .select("id, descripcion, tipo, monto_total, monto_pagado, fecha_vencimiento, estado, frecuencia_pago")
    .order("fecha_vencimiento", { ascending: true, nullsFirst: false });

  const pasivoIds = (pasivos ?? []).map((p) => p.id);

  const { data: pagosData } =
    pasivoIds.length > 0
      ? await supabase
          .from("datum_movimientos")
          .select("pasivo_id, monto, fecha")
          .in("pasivo_id", pasivoIds)
          .order("fecha", { ascending: false })
      : { data: [] };

  const pagosPorPasivo: Record<string, { monto: number; fecha: string }[]> = {};
  for (const pago of pagosData ?? []) {
    if (!pago.pasivo_id) continue;
    const lista = pagosPorPasivo[pago.pasivo_id] ?? [];
    lista.push({ monto: pago.monto, fecha: pago.fecha });
    pagosPorPasivo[pago.pasivo_id] = lista;
  }

  return <DirectorioPasivos pasivos={pasivos ?? []} pagosPorPasivo={pagosPorPasivo} />;
}
