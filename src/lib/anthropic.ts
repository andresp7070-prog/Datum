import Anthropic from "@anthropic-ai/sdk";

// Modelo más barato disponible — este resumen solo redacta y prioriza
// anomalías que el motor estadístico (anomalias.ts) ya calculó, no necesita
// razonar sobre datos crudos. Ver CLAUDE.md, sección "Panel de control".
const MODELO = "claude-haiku-4-5-20251001";

export type AnomaliaResumen = {
  modulo: string;
  titulo: string;
  detalle: string;
};

export async function generarResumenInsights(anomalias: AnomaliaResumen[]): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || anomalias.length === 0) return null;

  const listado = anomalias.map((a, i) => `${i + 1}. [${a.modulo}] ${a.titulo}: ${a.detalle}`).join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const mensaje = await client.messages.create({
      model: MODELO,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Eres un asesor de negocios para una pyme colombiana. Un motor de estadística ya analizó los datos de esta empresa y encontró estos patrones que se salen de lo normal para SU propio historial (no inventes datos nuevos, solo interpreta y prioriza lo que ya está aquí):\n\n${listado}\n\nEscribe un resumen ejecutivo en español, en tono cercano y práctico (no técnico), de máximo 4-5 frases, resaltando lo más importante para el dueño del negocio y sugiriendo una acción concreta si aplica. Texto corrido, sin viñetas ni markdown.`,
        },
      ],
    });

    const bloque = mensaje.content.find((b) => b.type === "text");
    return bloque && bloque.type === "text" ? bloque.text.trim() : null;
  } catch {
    return null;
  }
}
