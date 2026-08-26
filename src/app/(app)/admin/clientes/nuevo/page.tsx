import { requerirAdmin } from "@/lib/empresa";
import { NuevoClienteForm } from "./nuevo-cliente-form";

export default async function NuevoClientePage() {
  await requerirAdmin();
  return <NuevoClienteForm />;
}
