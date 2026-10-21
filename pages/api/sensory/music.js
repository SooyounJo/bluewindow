import { buildLyriaPrompt } from "@/lib/sensory/buildMusicPrompt";
import { hasGeminiKey, resolveLyriaModel } from "@/lib/sensory/env";
import { MEMORY_MAX } from "@/lib/sensory/prompt";
import { generateLyriaMusic } from "@/lib/sensory/providers/lyriaMusic";

export const config = {
  api: { bodyParser: { sizeLimit: "12mb" }, responseLimit: false },
  maxDuration: 300,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!hasGeminiKey()) {
    return res.status(503).json({
      error: "GEMINI_API_KEY is not configured",
      hint: "Lyria needs a Google AI Studio key (GEMINI_API_KEY) in .env.",
    });
  }

  const { analysis, imageDataUrl, varietySeed, memory } = req.body || {};
  if (!analysis || typeof analysis !== "object") {
    return res.status(400).json({ error: "analysis object is required" });
  }
  const hasImage = typeof imageDataUrl === "string" && imageDataUrl.length > 0;
  const model = resolveLyriaModel({ hasImage });
  const prompt = buildLyriaPrompt(analysis, {
    model,
    varietySeed: typeof varietySeed === "string" ? varietySeed : "",
    memory: typeof memory === "string" ? memory.trim().slice(0, MEMORY_MAX) : "",
  });

  try {
    const result = await generateLyriaMusic({ prompt, imageDataUrl: hasImage ? imageDataUrl : null });
    return res.status(200).json({
      model: result.model,
      mimeType: result.mimeType,
      dataUrl: `data:${result.mimeType};base64,${result.base64}`,
    });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Lyria failed" });
  }
}
