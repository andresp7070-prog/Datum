import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { requerirModulo } from "@/lib/empresa";
import { PeriodoNominaDetalle } from "./periodo-detalle";

export default async function PeriodoNominaPage({ params }: { params: Promise<{ id: string }> }) {
  await requerirModulo("nomina");
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return (
      <p className="text-red-600">
        Tu usuario no tiene una empresa asignada. Pídele a un administrador que la configure.
      </p>
    );
  }

  // Ninguna depende de la otra — ambas solo necesitan el id de la ruta.
  const [{ data: periodo }, { data: detallesData }] = await Promise.all([
    supabase
      .from("nomina_periodos")
      .select("id, fecha_inicio, fecha_fin, fecha_pago, estado")
      .eq("id", id)
      .eq("empresa_id", perfil.empresa_id)
      .single(),
    supabase
      .from("nomina_detalles")
      .select(
        "id, salario_base, auxilio_transporte, deduccion_salud, deduccion_pension, total_devengado, total_deducido, neto_pagado, total_aportes_patronales, provision_cesantias, provision_intereses_cesantias, provision_prima, provision_vacaciones, empleados ( nombre, cargo )",
      )
      .eq("periodo_id", id)
      .order("id"),
  ]);

  if (!periodo) notFound();

  type DetalleRaw = {
    id: string;
    salario_base: number;
    auxilio_transporte: number;
    deduccion_salud: number;
    deduccion_pension: number;
    total_devengado: number;
    total_deducido: number;
    neto_pagado: number;
    total_aportes_patronales: number;
    provision_cesantias: number;
    provision_intereses_cesantias: number;
    provision_prima: number;
    provision_vacaciones: number;
    empleados: { nombre: string; cargo: string | null } | { nombre: string; cargo: string | null }[] | null;
  };

  const detalles = ((detallesData ?? []) as DetalleRaw[]).map((d) => {
    const empleado = Array.isArray(d.empleados) ? d.empleados[0] : d.empleados;
    return {
      id: d.id,
      nombreEmpleado: empleado?.nombre ?? "Empleado eliminado",
      cargo: empleado?.cargo ?? null,
      salarioBase: d.salario_base,
      auxilioTransporte: d.auxilio_transporte,
      deduccionSalud: d.deduccion_salud,
      deduccionPension: d.deduccion_pension,
      totalDevengado: d.total_devengado,
      totalDeducido: d.total_deducido,
      netoPagado: d.neto_pagado,
      totalAportesPatronales: d.total_aportes_patronales,
      totalPrestaciones: d.provision_cesantias + d.provision_intereses_cesantias + d.provision_prima,
      totalVacaciones: d.provision_vacaciones,
    };
  });

  return <PeriodoNominaDetalle periodo={periodo} detalles={detalles} />;
}
