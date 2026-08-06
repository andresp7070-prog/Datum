import Link from "next/link";
import { login } from "./actions";
import { CampoPassword } from "./campo-password";

function LogoCompass({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={`${className} shrink-0`} aria-hidden="true">
      <path
        d="M 24 42 A 18 18 0 1 1 36.321 37.122"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M24 10 L29 24 L24 38 L19 24 Z" fill="currentColor" />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="mb-6 flex items-center gap-2 text-accent">
        <LogoCompass className="h-9 w-9" />
        <span className="font-serif text-3xl font-semibold text-gray-900">Datum</span>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-gray-900">Iniciar sesión</h1>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <form action={login} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <Link href="/recuperar-password" className="text-xs text-gray-500 hover:text-gray-700">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <CampoPassword />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
