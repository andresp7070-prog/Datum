"use client";

// Prioridad manual de un lead, 1 a 3 como un podio (1 = alta, 2 = media,
// 3 = baja) — colores fijos para verse de un vistazo en el Kanban y en el
// directorio, igual criterio en ambos CRM (clientes y leads de Datum).
export const ETIQUETAS_PRIORIDAD: Record<number, string> = { 1: "Alta", 2: "Media", 3: "Baja" };
const COLORES_PRIORIDAD: Record<number, string> = {
  1: "bg-red-100 text-red-700",
  2: "bg-amber-100 text-amber-700",
  3: "bg-gray-200 text-gray-600",
};

export function PrioridadBadge({ valor }: { valor: number | null }) {
  if (!valor) return null;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLORES_PRIORIDAD[valor]}`}>
      {ETIQUETAS_PRIORIDAD[valor]}
    </span>
  );
}

export function PrioridadSelector({
  valor,
  onChange,
  deshabilitado,
}: {
  valor: number | null;
  onChange: (valor: number | null) => void;
  deshabilitado?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          type="button"
          disabled={deshabilitado}
          onClick={() => onChange(valor === n ? null : n)}
          className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
            valor === n ? COLORES_PRIORIDAD[n] : "bg-gray-50 text-gray-400 hover:bg-gray-100"
          }`}
        >
          {ETIQUETAS_PRIORIDAD[n]}
        </button>
      ))}
    </div>
  );
}

export function PrioridadFiltro({
  valor,
  onChange,
}: {
  valor: string;
  onChange: (valor: string) => void;
}) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
    >
      <option value="todas">Cualquier prioridad</option>
      <option value="1">Alta</option>
      <option value="2">Media</option>
      <option value="3">Baja</option>
      <option value="sin">Sin prioridad</option>
    </select>
  );
}
