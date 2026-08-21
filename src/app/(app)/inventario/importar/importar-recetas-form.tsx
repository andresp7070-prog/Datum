"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parsearCsv } from "@/lib/csv";
import { sinTildes, numeroDesdeTexto } from "@/lib/texto";
import { normalizarUnidad, etiquetaUnidad, convertir } from "@/lib/unidades";
import { DescargarCsv } from "@/components/descargar-csv";
import { cargarRecetasIniciales, type FilaRecetaImportacion } from "./actions";

const COLUMNAS_ESPERADAS = ["producto", "insumo", "cantidad", "medida"];

type FilaPreview = FilaRecetaImportacion & {
  cantidadOriginal: string;
  medidaOriginal: string;
  unidadInsumo: string | null;
  cantidadConvertida: boolean;
  errores: string[];
};

function normalizarEncabezado(valor: string) {
  return sinTildes(valor.trim());
}

// Redondea a 4 decimales (mismo tope que cantidad_insumo en la base de
// datos) y quita ceros de sobra, para que la conversión no se vea como
// "0.30000000000000004" en la vista previa.
function formatoCantidad(valor: number) {
  return Number(valor.toFixed(4)).toString();
}

export function ImportarRecetasForm({
  puntoVentaId = null,
  items = [],
}: {
  puntoVentaId?: string | null;
  items?: { nombre: string; unidad: string }[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  // Mismo criterio de coincidencia (sin tildes, sin mayúsculas) que usa
  // cargar_recetas_iniciales() del lado del servidor.
  const unidadPorNombre = new Map(items.map((item) => [sinTildes(item.nombre), item.unidad]));

  const [filas, setFilas] = useState<FilaPreview[]>([]);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ creadas: number; errores: string[] } | null>(null);

  function limpiar() {
    setFilas([]);
    setNombreArchivo(null);
    setErrorArchivo(null);
    setResultado(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function procesarArchivo(file: File) {
    setResultado(null);
    setError(null);
    setNombreArchivo(file.name);

    const lector = new FileReader();
    lector.onload = () => {
      const texto = String(lector.result ?? "");
      const filasCrudas = parsearCsv(texto);

      if (filasCrudas.length < 2) {
        setErrorArchivo("El archivo no tiene filas de datos, solo encabezado (o está vacío).");
        setFilas([]);
        return;
      }

      const encabezado = filasCrudas[0].map(normalizarEncabezado);
      const faltantes = COLUMNAS_ESPERADAS.filter((c) => !encabezado.includes(c));
      if (faltantes.length > 0) {
        setErrorArchivo(
          `Faltan columnas en el archivo: ${faltantes.join(", ")}. Usa la plantilla tal cual, sin cambiar los títulos.`,
        );
        setFilas([]);
        return;
      }

      const indice = Object.fromEntries(COLUMNAS_ESPERADAS.map((c) => [c, encabezado.indexOf(c)]));

      const filasParseadas: FilaPreview[] = filasCrudas.slice(1).map((fila) => {
        const producto = (fila[indice.producto] ?? "").trim();
        const insumo = (fila[indice.insumo] ?? "").trim();
        const cantidadOriginal = (fila[indice.cantidad] ?? "").trim();
        const medidaOriginal = (fila[indice.medida] ?? "").trim();
        const cantidadEscrita = numeroDesdeTexto(cantidadOriginal);
        const unidadInsumo = insumo ? (unidadPorNombre.get(sinTildes(insumo)) ?? null) : null;

        const errores: string[] = [];
        if (!producto) errores.push("Falta el nombre del producto");
        if (!insumo) errores.push("Falta el nombre del insumo");
        if (!cantidadOriginal || Number.isNaN(cantidadEscrita) || cantidadEscrita <= 0) {
          errores.push(`Cantidad "${cantidadOriginal}" no es un número válido mayor a cero`);
        }

        // "medida" es opcional: si se deja vacía, se asume que la cantidad
        // ya está en la misma unidad en la que tienes cargado ese insumo
        // (comportamiento de siempre). Si se llena, se convierte a la
        // unidad real del insumo, para poder escribir la receta en la
        // unidad que sea más natural (ej. gramos) aunque el insumo esté
        // cargado en otra (ej. kilogramos).
        let cantidadFinal = cantidadEscrita;
        let cantidadConvertida = false;
        if (medidaOriginal) {
          const { valor: medida, reconocida } = normalizarUnidad(medidaOriginal);
          if (!reconocida) {
            errores.push(`Medida "${medidaOriginal}" no reconocida`);
          } else if (unidadInsumo && medida !== unidadInsumo) {
            try {
              cantidadFinal = convertir(cantidadEscrita, medida, unidadInsumo);
              cantidadConvertida = true;
            } catch {
              errores.push(
                `No se puede convertir "${medidaOriginal}" a la unidad del insumo (${etiquetaUnidad(unidadInsumo)})`,
              );
            }
          }
        }

        return {
          producto,
          insumo,
          cantidad: cantidadFinal,
          cantidadOriginal,
          medidaOriginal,
          unidadInsumo,
          cantidadConvertida,
          errores,
        };
      });

      if (filasParseadas.length === 0) {
        setErrorArchivo("El archivo no tiene filas de datos.");
        setFilas([]);
        return;
      }

      setErrorArchivo(null);
      setFilas(filasParseadas);
    };
    lector.onerror = () => setErrorArchivo("No se pudo leer el archivo.");
    lector.readAsText(file, "utf-8");
  }

  async function confirmar() {
    setError(null);
    setCargando(true);
    try {
      const filasValidas = filas.filter((fila) => fila.errores.length === 0);
      const resultado = await cargarRecetasIniciales(filasValidas, puntoVentaId);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setResultado({ creadas: resultado.creadas ?? 0, errores: resultado.errores ?? [] });
      setFilas([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar las recetas.");
    } finally {
      setCargando(false);
    }
  }

  const filasConError = filas.filter((fila) => fila.errores.length > 0);
  const filasValidas = filas.filter((fila) => fila.errores.length === 0);

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Paso 2 — Importar recetas</h2>
          <p className="mt-1 text-sm text-gray-500">
            Opcional. Solo si tienes productos compuestos (ej. un plato hecho de varios insumos).
          </p>
        </div>
        <DescargarCsv
          filas={[
            { producto: "Bandeja paisa", insumo: "Arroz", cantidad: 300, medida: "gramos" },
            { producto: "Bandeja paisa", insumo: "Carne molida", cantidad: 200, medida: "gramos" },
          ]}
          columnas={[
            { clave: "producto", titulo: "producto" },
            { clave: "insumo", titulo: "insumo" },
            { clave: "cantidad", titulo: "cantidad" },
            { clave: "medida", titulo: "medida" },
          ]}
          nombreArchivo="plantilla-recetas.csv"
        />
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <p className="mb-2 font-medium text-gray-900">Cómo funciona</p>
        <p className="mb-1">
          1. Primero carga tus productos en el Paso 1 de arriba — este archivo busca cada producto
          e insumo por su nombre en lo que ya quedó en el inventario, no crea productos nuevos.
        </p>
        <p className="mb-1">
          2. Una fila por cada insumo de cada receta — si un plato lleva 3 insumos, va en 3 filas
          con el mismo nombre de producto. &quot;cantidad&quot; es cuánto se consume del insumo por CADA
          unidad que se produce del producto.
        </p>
        <p className="mb-1">
          3. &quot;medida&quot; te deja escribir esa cantidad en la unidad que te sea más natural (ej.
          <em> gramos</em>), aunque el insumo esté cargado en otra (ej. kilogramos) — el sistema
          convierte solo. Si la dejas vacía, asume que la cantidad ya está en la misma unidad en
          la que tienes cargado ese insumo.
        </p>
        <p>
          4. Si un producto ya aparece en el archivo, su receta anterior (si tenía) se reemplaza
          por completo con lo que traiga el archivo — vas a ver una vista previa antes de
          confirmar nada.
        </p>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">Archivo CSV</label>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) procesarArchivo(file);
          }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-sm"
        />
        {nombreArchivo && !errorArchivo && (
          <p className="mt-1 text-xs text-gray-400">{nombreArchivo}</p>
        )}
        {errorArchivo && <p className="mt-1 text-xs text-red-600">{errorArchivo}</p>}
      </div>

      {filas.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-gray-900">
              Vista previa ({filas.length} fila{filas.length === 1 ? "" : "s"})
            </p>
            {filasConError.length > 0 && (
              <DescargarCsv
                etiqueta="Descargar archivo con errores"
                filas={filas.map((fila) => ({
                  producto: fila.producto,
                  insumo: fila.insumo,
                  cantidad: fila.cantidadOriginal,
                  medida: fila.medidaOriginal,
                  error: fila.errores.join(" / "),
                }))}
                columnas={[
                  { clave: "producto", titulo: "producto" },
                  { clave: "insumo", titulo: "insumo" },
                  { clave: "cantidad", titulo: "cantidad" },
                  { clave: "medida", titulo: "medida" },
                  { clave: "error", titulo: "error" },
                ]}
                nombreArchivo="recetas-con-errores.csv"
              />
            )}
          </div>
          {filasConError.length > 0 && (
            <p className="mb-2 text-xs text-amber-600">
              {filasConError.length} fila{filasConError.length === 1 ? "" : "s"} tienen algún
              problema (columna &quot;Error&quot; abajo) y no se van a importar. Corrígelas en tu CSV
              original y vuelve a subirlo si quieres incluirlas.
            </p>
          )}
          <div className="max-h-80 overflow-y-auto rounded-xl border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs text-gray-400">
                <tr>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2">Insumo</th>
                  <th className="px-3 py-2">Cantidad</th>
                  <th className="px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filas.map((fila, i) => (
                  <tr key={i} className={fila.errores.length > 0 ? "bg-amber-50" : undefined}>
                    <td className="px-3 py-2 text-gray-900">{fila.producto || "—"}</td>
                    <td className="px-3 py-2 text-gray-500">{fila.insumo || "—"}</td>
                    <td className="px-3 py-2 text-gray-500">
                      {fila.cantidadOriginal || "—"}
                      {fila.medidaOriginal && ` ${fila.medidaOriginal}`}
                      {fila.cantidadConvertida && fila.unidadInsumo && (
                        <span className="text-gray-400">
                          {" "}
                          → {formatoCantidad(fila.cantidad)} {etiquetaUnidad(fila.unidadInsumo)}
                        </span>
                      )}
                      {!fila.medidaOriginal &&
                        fila.unidadInsumo &&
                        ` ${etiquetaUnidad(fila.unidadInsumo)}`}
                    </td>
                    <td className="px-3 py-2 text-amber-600">
                      {fila.errores.length > 0 ? fila.errores.join(" / ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={confirmar}
              disabled={cargando || filasValidas.length === 0}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {cargando ? "Importando..." : `Confirmar carga de ${filasValidas.length} línea(s)`}
            </button>
            <button
              type="button"
              onClick={limpiar}
              disabled={cargando}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {resultado && (
        <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          <p>
            Listo: {resultado.creadas} línea{resultado.creadas === 1 ? "" : "s"} de receta
            conectada{resultado.creadas === 1 ? "" : "s"}.
          </p>
          {resultado.errores.length > 0 && (
            <div className="mt-2 text-amber-700">
              <p>{resultado.errores.length} línea(s) no se pudieron conectar:</p>
              <ul className="ml-4 list-disc">
                {resultado.errores.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
