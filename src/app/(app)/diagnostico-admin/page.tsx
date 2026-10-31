import { createClient } from "@/lib/supabase/server";

// Diagnóstico temporal (2026-10-31) — para ver, lado a lado, el id real de
// la sesión actual contra SUPER_ADMIN_USER_ID tal como lo ve el servidor en
// este despliegue. requerirAdmin() (src/lib/empresa.ts) manda acá en vez de
// a /resumen cuando no coinciden, para no caer en el bucle /admin ↔
// /resumen. Borrar esta página junto con ese desvío temporal en cuanto se
// resuelva el caso real.
export default async function DiagnosticoAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const superAdminId = process.env.SUPER_ADMIN_USER_ID;

  return (
    <div style={{ fontFamily: "monospace", fontSize: "14px", lineHeight: 1.8 }}>
      <h1>Diagnóstico temporal — requerirAdmin()</h1>
      <p>
        Tu usuario (auth.uid): <strong>{user?.id ?? "sin sesión"}</strong>
      </p>
      <p>
        SUPER_ADMIN_USER_ID (como lo ve el servidor ahora mismo):{" "}
        <strong>{superAdminId ?? "no está definida en este ambiente"}</strong>
      </p>
      <p>
        ¿Coinciden exactamente?: <strong>{user?.id === superAdminId ? "SÍ" : "NO"}</strong>
      </p>
    </div>
  );
}
