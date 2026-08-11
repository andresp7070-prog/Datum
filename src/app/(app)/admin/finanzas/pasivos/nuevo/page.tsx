import { requerirAdmin } from "@/lib/empresa";
import { NuevoPasivoForm } from "./nuevo-pasivo-form";

export default async function NuevoPasivoDatumPage() {
  await requerirAdmin();
  return <NuevoPasivoForm />;
}
