export function readEnvKey(name) {
  const raw = process.env[name];
  if (!raw || typeof raw !== "string") {
    return "";
  }
  return raw.trim().replace(/^["']|["']$/g, "");
}

export function hasOpenAIKey() {
  return readEnvKey("OPENAI_API_KEY").length > 0;
}

export function hasGeminiKey() {
  return readEnvKey("GEMINI_API_KEY").length > 0;
}

// openai | gemini | auto
export function resolveVisionProvider() {
  const hasOpenAI = hasOpenAIKey();
  const hasGemini = hasGeminiKey();
  const pref = (process.env.SENSORY_VISION_PROVIDER || "auto").toLowerCase();

  if (pref === "gemini") {
    return hasGemini ? "gemini" : hasOpenAI ? "openai" : null;
  }
  if (pref === "openai") {
    return hasOpenAI ? "openai" : null;
  }
  if (hasGemini) {
    return "gemini";
  }
  return hasOpenAI ? "openai" : null;
}

// Lyria 3 계열: https://ai.google.dev/gemini-api/docs/music-generation
export function resolveLyriaModel({ hasImage = false } = {}) {
  const fromEnv = (process.env.LYRIA_MODEL || "").trim();
  if (fromEnv) {
    return fromEnv;
  }
  return hasImage ? "lyria-3.5" : "lyria-3-clip-preview";
}

export function visionModelName(provider) {
  if (provider === "openai") {
    return process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
  }
  if (provider === "gemini") {
    return process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";
  }
  return null;
}
