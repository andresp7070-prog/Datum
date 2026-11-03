"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mensajeErrorAuth } from "@/lib/auth-errores";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(mensajeErrorAuth(error))}`);
  }

  // Una cuenta de usuario es de una sola persona a la vez — cualquier login
  // nuevo cierra cualquier otra sesión abierta de este mismo usuario, en
  // cualquier otro dispositivo. scope: "others" es parte del propio
  // Supabase Auth (no una función exclusiva de la plataforma): revoca los
  // demás refresh tokens de este usuario sin tocar la sesión recién creada.
  // Este paso antes no revisaba su propio error (quedaba oculto, se veía
  // igual que "no hay sesión") — se dejó así a propósito desde el
  // 2026-10-31, tras una sesión larga de depuración en Preview donde esto
  // no terminó siendo la causa real, pero confirmó que vale la pena no
  // tragarse el error de un paso de autenticación.
  const { error: errorSignOut } = await supabase.auth.signOut({ scope: "others" });
  if (errorSignOut) {
    redirect(
      `/login?error=${encodeURIComponent(`Fallo cerrando otras sesiones: ${errorSignOut.message}`)}`,
    );
  }

  redirect("/");
}
