"use client";

import { useState } from "react";

export function CampoPassword() {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
        Contraseña
      </label>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={visible ? "text" : "password"}
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-gray-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
        >
          {visible ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4.5 w-4.5">
              <path
                d="M3 3l18 18M10.6 10.6a2.5 2.5 0 0 0 3.5 3.5M9.4 5.5A10.9 10.9 0 0 1 12 5c5 0 9 4 10.5 7-.5 1-1.2 2.1-2.2 3.1M6.5 6.6C4.5 8 3 9.9 1.5 12c1.5 3 5.5 7 10.5 7 1.4 0 2.7-.3 3.9-.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4.5 w-4.5">
              <path
                d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7-10.5-7-10.5-7Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="2.5" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
