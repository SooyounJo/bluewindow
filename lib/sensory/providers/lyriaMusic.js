import { readEnvKey, resolveLyriaModel } from "@/lib/sensory/env";

const INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

export function extractAudioBase64(json) {
  if (!json || typeof json !== "object") {
    return null;
  }
  const direct = json.output_audio ?? json.outputAudio;
  if (direct && typeof direct === "object" && typeof direct.data === "string" && direct.data.length > 0) {
    return direct.data;
  }

  const steps = json.steps ?? json.interaction?.steps;
  if (!Array.isArray(steps)) {
    return null;
  }
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const step = steps[i];
    if (!step || typeof step !== "object") {
      continue;
    }
    const blocks = step.content ?? step.contents ?? step.model_output ?? step.modelOutput ?? [];
    const list = Array.isArray(blocks) ? blocks : [blocks];
    for (const b of list) {
      if (!b || typeof b !== "object") {
        continue;
      }
      if (b.type === "audio" && typeof b.data === "string") {
        return b.data;
      }
      if (b.inline_data && typeof b.inline_data === "object" && b.inline_data.data) {
        return b.inline_data.data;
      }
    }
  }
  return null;
}

export async function generateLyriaMusic({ prompt, imageDataUrl = null }) {
  const apiKey = readEnvKey("GEMINI_API_KEY");
  const model = resolveLyriaModel({ hasImage: Boolean(imageDataUrl) });

  let input = prompt;
  const match = imageDataUrl && imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    input = [
      { type: "text", text: prompt },
      { type: "image", mime_type: match[1], data: match[2] },
    ];
  }

  const response = await fetch(INTERACTIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ model, input }),
  });

  if (!response.ok) {
    const text = await response.text();
    let detail = text.slice(0, 400);
    try {
      const parsed = JSON.parse(text);
      const msg = parsed?.error?.message ?? parsed?.[0]?.error?.message ?? parsed?.message;
      if (typeof msg === "string") {
        detail = msg;
      }
    } catch {
      /* 원문 일부 유지 */
    }
    if (response.status === 402) {
      throw new Error(`Lyria 결제 크레딧이 부족합니다(402). AI Studio에서 Billing·선불 크레딧을 충전해야 합니다. (${detail})`);
    }
    throw new Error(`Lyria error ${response.status}: ${detail}`);
  }

  const json = await response.json();
  const base64 = extractAudioBase64(json);
  if (!base64) {
    throw new Error("Lyria response had no audio data");
  }
  return { base64, mimeType: "audio/mpeg", model };
}
