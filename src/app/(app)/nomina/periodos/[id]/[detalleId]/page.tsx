import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { requerirModulo } from "@/lib/empresa";
import { DesprendibleImprimir } from "./desprendible-imprimir";

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function formatoFecha(valor: string) {
  return new Date(`${valor}T00:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function DesprendiblePage({
  params,
}: {
  params: Promise<{ id: string; detalleId: string }>;
}) {
  await requerirModulo("nomina");
  const { id, detalleId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id, empresas ( nombre )")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return (
      <p className="text-red-600">
        Tu usuario no tiene una empresa asignada. Pídele a un administrador que la configure.
      </p>
    );
  }

  const empresa = Array.isArray(perfil.empresas) ? perfil.empresas[0] : perfil.empresas;

  // Ninguna depende de la otra — ambas solo necesitan los ids de la ruta.
  const [{ data: periodo }, { data: detalleData }] = await Promise.all([
    supabase
      .from("nomina_periodos")
      .select("id, fecha_inicio, fecha_fin, fecha_pago, estado")
      .eq("id", id)
      .eq("empresa_id", perfil.empresa_id)
      .single(),
    supabase
      .from("nomina_detalles")
      .select(
        "id, salario_base, auxilio_transporte, deduccion_salud, deduccion_pension, total_devengado, total_deducido, neto_pagado, empleados ( nombre, cedula, cargo )",
      )
      .eq("id", detalleId)
      .eq("periodo_id", id)
      .single(),
  ]);

  if (!periodo) notFound();
  if (!detalleData) notFound();

  const empleadoRaw = Array.isArray(detalleData.empleados) ? detalleData.empleados[0] : detalleData.empleados;

  return (
    <DesprendibleImprimir
      empresaNombre={empresa?.nombre ?? "Empresa"}
      empleadoNombre={empleadoRaw?.nombre ?? "Empleado eliminado"}
      empleadoCedula={empleadoRaw?.cedula ?? null}
      empleadoCargo={empleadoRaw?.cargo ?? null}
      periodoTexto={`${formatoFecha(periodo.fecha_inicio)} — ${formatoFecha(periodo.fecha_fin)}`}
      fechaPagoTexto={formatoFecha(periodo.fecha_pago)}
      estado={periodo.estado}
      volverHref={`/nomina/periodos/${id}`}
      salarioBase={formatoMoneda(detalleData.salario_base)}
      auxilioTransporte={formatoMoneda(detalleData.auxilio_transporte)}
      totalDevengado={formatoMoneda(detalleData.total_devengado)}
      deduccionSalud={formatoMoneda(detalleData.deduccion_salud)}
      deduccionPension={formatoMoneda(detalleData.deduccion_pension)}
      totalDeducido={formatoMoneda(detalleData.total_deducido)}
      netoPagado={formatoMoneda(detalleData.neto_pagado)}
    />
  );
}
