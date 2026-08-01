import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Server-side AI analysis endpoint for telecom operations
app.post("/api/analyze", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: "GEMINI_API_KEY not configured",
        summary: "Análisis automático heurístico activo: El módulo de IA requiere configurar la clave de API en el panel de secretos."
      });
    }

    const { period, totalReports, prevWeekReports, currWeekReports, topGroups, topCentrales, dayStats } = req.body;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const prompt = `
Eres un Ingeniero Principal de Operaciones y Estadística de Redes de Telecomunicaciones.
Analiza la siguiente información de reportes e incidencias operativas de las centrales telefónicas y genera un informe técnico ejecutivo en español con tono profesional, conciso y estructurado:

- Período: ${period || "Reciente"}
- Total de Reportes en el período: ${totalReports}
- Reportes Semana Anterior: ${prevWeekReports}
- Reportes Semana Actual: ${currWeekReports}
- Variación Semanal: ${prevWeekReports > 0 ? (((currWeekReports - prevWeekReports) / prevWeekReports) * 100).toFixed(1) : 0}%
- Grupos con mayor volumen de averías: ${JSON.stringify(topGroups || [])}
- Centrales Telefónicas más afectadas: ${JSON.stringify(topCentrales || [])}
- Comportamiento por día de la semana (Lunes a Sábado): ${JSON.stringify(dayStats || [])}

Proporciona un dictamen técnico breve que incluya:
1. **Evaluación de la Variación Semanal**: Explica cómo se comportó la red la semana pasada en comparación con la actual.
2. **Análisis de Puntos Críticos**: Comenta las centrales y grupos técnicos de trabajo con mayor desviación (ej. Planta Exterior, Transmisión, Conmutación).
3. **Diagnóstico Probable y Patrones Temporales**: Mención de probables causas raíz (ej. tormentas, falla de climatización/energía, cortes de fibra) según los días pico.
4. **Recomendaciones Operativas**: 3 acciones concretas para el equipo técnico para reducir la tasa de fallas y acelerar el tiempo de resolución (MTTR).
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    res.json({
      analysis: response.text,
    });
  } catch (error: any) {
    console.error("Error in Gemini API analysis:", error);
    res.status(500).json({
      error: "Error processing analysis",
      details: error?.message || String(error)
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TelecomStat NOC server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
