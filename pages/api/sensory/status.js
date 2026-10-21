import { hasGeminiKey, resolveLyriaModel, resolveVisionProvider, visionModelName } from "@/lib/sensory/env";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const provider = resolveVisionProvider();
  return res.status(200).json({
    visionReady: Boolean(provider),
    provider,
    model: visionModelName(provider),
    lyriaReady: hasGeminiKey(),
    lyriaModel: resolveLyriaModel({ hasImage: true }),
  });
}
