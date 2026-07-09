import { requerirModulo } from "@/lib/empresa";
import { NuevoClienteForm } from "./nuevo-cliente-form";

export default async function NuevoClientePage() {
  await requerirModulo("crm");

  return <NuevoClienteForm />;
}
