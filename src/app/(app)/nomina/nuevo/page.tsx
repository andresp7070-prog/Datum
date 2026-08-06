import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requerirModulo } from "@/lib/empresa";
import { NuevoEmpleadoForm } from "./nuevo-empleado-form";

export default async function NuevoEmpleadoPage() {
  await requerirModulo("nomina");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <NuevoEmpleadoForm />;
}
