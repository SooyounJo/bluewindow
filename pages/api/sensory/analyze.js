import { resolveVisionProvider } from "@/lib/sensory/env";
import { MEMORY_MAX } from "@/lib/sensory/prompt";
import { normalizeWindowAnalysis } from "@/lib/sensory/parseResponse";
import { analyzeWithGemini, analyzeWithOpenAI } from "@/lib/sensory/providers/vision";

export const config = {
  api: { bodyParser: { sizeLimit: "8mb" } },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { imageDataUrl, dominantColors, memory } = req.body || {};
  if (!imageDataUrl || typeof imageDataUrl !== "string") {
    return res.status(400).json({ error: "imageDataUrl is required" });
  }
  const colors = Array.isArray(dominantColors) ? dominantColors.filter((c) => typeof c === "string") : [];
  const memoryText = typeof memory === "string" ? memory.trim().slice(0, MEMORY_MAX) : "";

  const provider = resolveVisionProvider();
  if (!provider) {
    return res.status(503).json({
      error: "Vision API key is not configured",
      hint: "Add OPENAI_API_KEY or GEMINI_API_KEY to .env and restart yarn dev.",
    });
  }

  try {
    const input = { imageDataUrl, dominantColors: colors, memory: memoryText };
    const raw = provider === "gemini" ? await analyzeWithGemini(input) : await analyzeWithOpenAI(input);
    const analysis = normalizeWindowAnalysis(raw, { dominantColors: colors });
    return res.status(200).json({ ...analysis, provider });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Analysis failed" });
  }
}
