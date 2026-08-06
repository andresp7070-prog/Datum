"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function crearEmpleado(input: {
  nombre: string;
  cedula: string;
  cargo: string;
  salarioBase: number;
  fechaIngreso: string;
  tipoContrato: string;
}): Promise<{ error: string | null; id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return { error: "Tu usuario no tiene una empresa asignada." };
  }

  const { data, error } = await supabase
    .from("empleados")
    .insert({
      empresa_id: perfil.empresa_id,
      nombre: input.nombre,
      cedula: input.cedula || null,
      cargo: input.cargo || null,
      salario_base: input.salarioBase,
      fecha_ingreso: input.fechaIngreso,
      tipo_contrato: input.tipoContrato,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { error: null, id: data.id as string };
}

export async function generarPeriodoNomina(input: {
  fechaInicio: string;
  fechaFin: string;
  fechaPago: string;
}): Promise<{ error: string | null; id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.empresa_id) {
    return { error: "Tu usuario no tiene una empresa asignada." };
  }

  const { data, error } = await supabase.rpc("generar_nomina", {
    p_empresa_id: perfil.empresa_id,
    p_fecha_inicio: input.fechaInicio,
    p_fecha_fin: input.fechaFin,
    p_fecha_pago: input.fechaPago,
  });

  if (error) return { error: error.message };
  revalidatePath("/nomina/periodos");
  return { error: null, id: data as string };
}

export async function marcarPeriodoPagado(periodoId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_nomina_pagada", { p_periodo_id: periodoId });

  if (error) return { error: error.message };
  revalidatePath(`/nomina/periodos/${periodoId}`);
  revalidatePath("/nomina/periodos");
  return { error: null };
}

export async function registrarVacaciones(input: {
  empleadoId: string;
  fechaInicio: string;
  fechaFin: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const dias =
    Math.round(
      (new Date(`${input.fechaFin}T00:00:00`).getTime() - new Date(`${input.fechaInicio}T00:00:00`).getTime()) /
        86400000,
    ) + 1;

  if (dias <= 0) {
    return { error: "La fecha de fin no puede ser antes de la fecha de inicio." };
  }

  const { error } = await supabase.from("nomina_vacaciones").insert({
    empleado_id: input.empleadoId,
    fecha_inicio: input.fechaInicio,
    fecha_fin: input.fechaFin,
    dias,
  });

  if (error) return { error: error.message };
  revalidatePath(`/nomina/${input.empleadoId}`);
  return { error: null };
}

export type MotivoSalida = "renuncia" | "despido_justa_causa" | "despido_sin_justa_causa";

export type Liquidacion = {
  fecha_desde: string;
  dias_periodo: number;
  salario_proporcional: number;
  auxilio_proporcional: number;
  deducciones_empleado: number;
  neto_periodo: number;
  aportes_patronales: number;
  cesantias_intereses_prima: number;
  dias_vacaciones_pendientes: number;
  monto_vacaciones_pendientes: number;
  dias_indemnizacion: number;
  monto_indemnizacion: number;
  indemnizacion_requiere_calculo_manual: boolean;
  total_a_pagar_empleado: number;
};

async function calcularLiquidacion(
  empleadoId: string,
  fechaRetiro: string,
  motivo: MotivoSalida,
  simular: boolean,
): Promise<{ error: string | null; liquidacion?: Liquidacion }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesión activa." };

  const { data, error } = await supabase.rpc("finalizar_contrato_empleado", {
    p_empleado_id: empleadoId,
    p_fecha_retiro: fechaRetiro,
    p_motivo: motivo,
    p_simular: simular,
  });

  if (error) return { error: error.message };
  const fila = (data as Liquidacion[])?.[0];
  if (!fila) return { error: "No se pudo calcular la liquidación." };

  if (!simular) {
    revalidatePath(`/nomina/${empleadoId}`);
    revalidatePath("/nomina");
    revalidatePath("/nomina/periodos");
  }

  return { error: null, liquidacion: fila };
}

export async function simularLiquidacion(empleadoId: string, fechaRetiro: string, motivo: MotivoSalida) {
  return calcularLiquidacion(empleadoId, fechaRetiro, motivo, true);
}

export async function confirmarFinalizacionContrato(empleadoId: string, fechaRetiro: string, motivo: MotivoSalida) {
  return calcularLiquidacion(empleadoId, fechaRetiro, motivo, false);
}
