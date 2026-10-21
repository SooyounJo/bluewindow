import {
  paletteSonicHint,
  pickAntiClicheLine,
  pickExtraTexture,
  pickLyriaArchetype,
} from "@/lib/sensory/musicVariety";

export function buildLyriaPrompt(analysis, { model = "", varietySeed = "", memory = "" } = {}) {
  const music = analysis?.music || {};
  const keywords = (analysis?.emotionKeywords || []).join(", ");
  const spatial = (analysis?.spatialKeywords || []).join(", ");
  const longForm = model.includes("3.5");
  const archetype = pickLyriaArchetype(analysis, varietySeed);
  const textureFocus = pickExtraTexture(analysis, varietySeed);
  const antiCliche = pickAntiClicheLine(analysis, varietySeed);
  const paletteHint = paletteSonicHint(analysis?.paletteHex);

  const tempoFeel = Math.min(100, Math.max(50, Math.round(music.tempo ?? 72)));
  const energy = Math.min(0.55, Math.max(0.12, music.energy ?? 0.3));
  const impression = analysis?.memoryImpression?.trim();

  return [
    `Create a ${longForm ? "90" : "30"}-second instrumental ${archetype.label} track for seamless background looping.`,
    `Sonic direction: ${archetype.sonic}. Avoid generic stock "meditation app" sound; make this identity recognizable.`,
    "Instrumental only: no vocals, no lyrics, no rap, no EDM drop, no loud drums.",
    `Dynamics: ambient background, energy ${energy.toFixed(2)}, tempo feel ~${tempoFeel} BPM or free-time.`,
    `Primary textures, emphasize: ${textureFocus}.`,
    paletteHint,
    antiCliche,
    memory ? `The listener's own memory of this place (Korean OK): "${memory}"` : "",
    impression ? `Scene impression: ${impression}` : "",
    music.description ? `Music brief: ${music.description}` : "",
    music.mood ? `Mood: ${music.mood}` : "",
    keywords ? `Emotion keywords: ${keywords}` : "",
    spatial ? `Space / place feeling: ${spatial}` : "",
    "Structure: evolve timbre every 8-15 seconds; no repeating 4-bar pop loop cliche.",
  ]
    .filter(Boolean)
    .join(" ");
}
