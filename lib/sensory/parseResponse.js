import { MOTIONS } from "@/lib/sensory/prompt";

const HEX = /^#[0-9A-Fa-f]{6}$/;

function motionIndex(v) {
  if (typeof v === "string") {
    const i = MOTIONS.findIndex((m) => m.name.toLowerCase() === v.trim().toLowerCase());
    if (i >= 0) {
      return i;
    }
  }
  return Math.round(clampNum(v, 0, MOTIONS.length - 1, 0));
}

export function normalizeWindowAnalysis(raw, { dominantColors = [] } = {}) {
  const o = raw && typeof raw === "object" ? raw : {};
  const m = o.music && typeof o.music === "object" ? o.music : {};

  return {
    memoryImpression: str(o.memoryImpression),
    emotionKeywords: strArray(o.emotionKeywords, 5),
    spatialKeywords: strArray(o.spatialKeywords, 6),
    paletteHex: hexList(o.paletteHex, dominantColors, 5),
    motion: motionIndex(o.motion),
    clarity: Math.round(clampNum(o.clarity, 0, 100, 55)),
    vivid: clampNum(o.vivid, 0.9, 1.3, 1),
    music: {
      tempo: clampNum(m.tempo, 50, 100, 72),
      energy: clampNum(m.energy, 0.12, 0.55, 0.32),
      mood: str(m.mood),
      instruments: strArray(m.instruments, 5),
      description: str(m.description),
    },
  };
}

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

function strArray(v, max) {
  if (!Array.isArray(v)) {
    return [];
  }
  return v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()).slice(0, max);
}

function clampNum(v, min, max, fallback) {
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, n));
}

function hexList(input, fallback, count) {
  const list = Array.isArray(input) ? input.filter((c) => typeof c === "string" && HEX.test(c)) : [];
  if (list.length >= count) {
    return list.slice(0, count);
  }
  const valid = fallback.filter((c) => HEX.test(c));
  return valid.length >= count ? valid.slice(0, count) : [];
}
