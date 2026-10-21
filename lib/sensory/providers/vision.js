import { readEnvKey, visionModelName } from "@/lib/sensory/env";
import { WINDOW_SYSTEM_PROMPT, buildWindowUserText } from "@/lib/sensory/prompt";

function splitDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image data URL");
  }
  return { mime: match[1], base64: match[2] };
}

export async function analyzeWithOpenAI({ imageDataUrl, dominantColors, memory }) {
  const apiKey = readEnvKey("OPENAI_API_KEY");
  splitDataUrl(imageDataUrl);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: visionModelName("openai"),
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: WINDOW_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: buildWindowUserText(dominantColors, memory) },
            { type: "image_url", image_url: { url: imageDataUrl, detail: "low" } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${text.slice(0, 200)}`);
  }
  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty OpenAI response");
  }
  return JSON.parse(content);
}

export async function analyzeWithGemini({ imageDataUrl, dominantColors, memory }) {
  const apiKey = readEnvKey("GEMINI_API_KEY");
  const { mime, base64 } = splitDataUrl(imageDataUrl);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${visionModelName("gemini")}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: `${WINDOW_SYSTEM_PROMPT}\n\n${buildWindowUserText(dominantColors, memory)}` },
            { inline_data: { mime_type: mime, data: base64 } },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json", temperature: 0.6 },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini error ${response.status}: ${text.slice(0, 200)}`);
  }
  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Empty Gemini response");
  }
  return JSON.parse(text);
}
