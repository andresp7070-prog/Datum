import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VentasTabs } from "../../ventas-tabs";
import { buscarVentaParaDevolucion } from "../actions";
import { NuevaDevolucionForm } from "./nueva-devolucion-form";

export default async function NuevaDevolucionPage({
  searchParams,
}: {
  searchParams: Promise<{ ventaId?: string; numero?: string }>;
}) {
  const { ventaId, numero } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let ventaInicial = null;
  let errorInicial: string | null = null;

  if (ventaId || numero) {
    const resultado = await buscarVentaParaDevolucion({
      ventaId,
      numeroVenta: numero ? Number(numero) : undefined,
    });
    ventaInicial = resultado.venta ?? null;
    errorInicial = resultado.error;
  }

  return (
    <div>
      <VentasTabs />
      <NuevaDevolucionForm ventaInicial={ventaInicial} errorInicial={errorInicial} />
    </div>
  );
}
