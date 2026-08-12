"use client";

export function BorrarLeadModal({
  nombreLead,
  borrando,
  onConfirm,
  onCancel,
}: {
  nombreLead: string;
  borrando: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">¿Borrar &ldquo;{nombreLead}&rdquo;?</h2>
        <p className="mb-4 text-xs text-gray-500">
          Se borra el lead junto con sus seguimientos, interacciones e historial. Esto no se puede
          deshacer.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={borrando}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={borrando}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {borrando ? "Borrando..." : "Sí, borrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
