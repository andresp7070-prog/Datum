import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requerirModulo } from "@/lib/empresa";
import { GenerarNominaForm } from "./generar-nomina-form";

export default async function NuevoPeriodoNominaPage() {
  await requerirModulo("nomina");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <GenerarNominaForm />;
}
