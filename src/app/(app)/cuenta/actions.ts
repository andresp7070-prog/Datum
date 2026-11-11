"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mensajeErrorAuth } from "@/lib/auth-errores";
import { enviarCorreoContrasenaActualizada } from "@/lib/email";

// Mismo patrón que restablecerPassword() (src/app/restablecer-password/actions.ts),
// pero acá la persona ya tiene sesión activa — al terminar, se cierra esa
// sesión y queda obligada a iniciar sesión de nuevo con la contraseña nueva.
export async function cambiarPassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const password = formData.get("password") as string;
  const confirmar = formData.get("confirmar") as string;

  if (!password || password.length < 6) {
    redirect(`/cuenta?error=${encodeURIComponent("La contraseña debe tener al menos 6 caracteres.")}`);
  }
  if (password !== confirmar) {
    redirect(`/cuenta?error=${encodeURIComponent("Las contraseñas no coinciden.")}`);
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/cuenta?error=${encodeURIComponent(mensajeErrorAuth(error))}`);
  }

  // Se busca la empresa y se manda el aviso ANTES de signOut() — después de
  // cerrar la sesión ya no hay con qué leer perfiles bajo RLS. Solo para
  // este cambio voluntario (Mi cuenta) — nunca para el obligatorio de
  // primer ingreso en /cambiar-password, que usa su propia acción aparte.
  const { data: perfil } = await supabase.from("perfiles").select("empresa_id").eq("id", user.id).single();
  if (perfil?.empresa_id && user.email) {
    const { data: empresa } = await supabase.from("empresas").select("nombre").eq("id", perfil.empresa_id).single();
    await enviarCorreoContrasenaActualizada({
      correo: user.email,
      nombreEmpresa: empresa?.nombre ?? "tu empresa",
    });
  }

  await supabase.auth.signOut();
  redirect("/login?password_actualizada=1");
}
