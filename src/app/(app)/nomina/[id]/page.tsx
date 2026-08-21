import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { requerirModulo } from "@/lib/empresa";
import { FichaEmpleado } from "./ficha-empleado";

export default async function EmpleadoPage({ params }: { params: Promise<{ id: string }> }) {
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

  // Las tres consultas solo dependen del id de la ruta (o de empresa_id, ya
  // conocido) — ninguna depende del resultado de otra, así que salen juntas.
  const [{ data: empleado }, { data: vacacionesInfo }, { data: vacacionesData }] = await Promise.all([
    supabase
      .from("empleados")
      .select("id, nombre, cedula, cargo, salario_base, fecha_ingreso, fecha_retiro, activo, tipo_contrato")
      .eq("id", id)
      .eq("empresa_id", perfil.empresa_id)
      .single(),
    supabase.from("vista_vacaciones_empleado").select("dias_causados, dias_tomados").eq("empleado_id", id).single(),
    supabase
      .from("nomina_vacaciones")
      .select("id, fecha_inicio, fecha_fin, dias")
      .eq("empleado_id", id)
      .order("fecha_inicio", { ascending: false }),
  ]);

  if (!empleado) notFound();

  return (
    <FichaEmpleado
      empleado={empleado}
      diasCausados={vacacionesInfo?.dias_causados ?? 0}
      diasTomados={vacacionesInfo?.dias_tomados ?? 0}
      vacaciones={vacacionesData ?? []}
    />
  );
}
