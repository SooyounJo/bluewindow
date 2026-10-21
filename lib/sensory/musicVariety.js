function fnv1a(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * @param {object} analysis
 * @param {string} [varietySeed] — Generate마다 새 값 → Lyria/합성 시그니처 분리
 */
export function fingerprintAnalysis(analysis, varietySeed = "") {
  const music = analysis?.music || {};
  const vis = analysis?.visualComposition || {};
  return [
    analysis?.memoryImpression,
    analysis?.situationGuess,
    (analysis?.emotionKeywords || []).join("|"),
    (analysis?.spatialKeywords || []).join("|"),
    (analysis?.paletteHex || []).join("|"),
    vis.layoutStyle,
    vis.motionSpeed,
    vis.dominantAngleDeg,
    music.description,
    music.mood,
    (music.instruments || []).join("|"),
    music.tempo,
    music.energy,
    varietySeed,
  ]
    .filter((x) => x !== undefined && x !== null && x !== "")
    .join("::");
}

const ARCHETYPE_KEYWORD_HINTS = [
  {
    label: "oceanic ambient",
    patterns: /바다|해변|파도|ocean|beach|sea|coast|물가|해안/i,
  },
  {
    label: "forest field ambient",
    patterns: /숲|나무|산|forest|wood|mountain|trail|들판|초원|park/i,
  },
  {
    label: "nocturnal urban ambient",
    patterns: /밤|도시|네온|night|urban|city|street|alley|창문|고층/i,
  },
  {
    label: "warm domestic ambient",
    patterns: /집|방|부엌|거실|home|room|kitchen|indoor|찻잔|침대/i,
  },
  {
    label: "sunlit pastoral ambient",
    patterns: /햇살|들|pastoral|meadow|sunlit|golden hour|들녘|논/i,
  },
  {
    label: "memory haze ambient",
    patterns: /그리움|추억|nostalg|memory|옛|retro|흐릿|lo-fi|사진/i,
  },
  {
    label: "minimal crystalline ambient",
    patterns: /겨울|눈|ice|glass|snow|frost|crystal|차가|맑/i,
  },
  {
    label: "misty drone ambient",
    patterns: /안개|mist|fog|rain|비|흐림| drizzle|몽환/i,
  },
];

/** @param {object} analysis */
function preferredArchetypeIndex(analysis) {
  const blob = [
    analysis?.memoryImpression,
    analysis?.situationGuess,
    ...(analysis?.spatialKeywords || []),
    ...(analysis?.emotionKeywords || []),
    analysis?.music?.description,
    analysis?.music?.mood,
  ]
    .filter(Boolean)
    .join(" ");
  if (!blob) {
    return null;
  }
  for (let i = 0; i < ARCHETYPE_KEYWORD_HINTS.length; i += 1) {
    if (ARCHETYPE_KEYWORD_HINTS[i].patterns.test(blob)) {
      const idx = LYRIA_ARCHETYPES.findIndex(
        (a) => a.label === ARCHETYPE_KEYWORD_HINTS[i].label
      );
      if (idx >= 0) {
        return idx;
      }
    }
  }
  return null;
}

/** @param {string[]} paletteHex */
export function paletteSonicHint(paletteHex) {
  const list = (paletteHex || []).filter(Boolean);
  if (list.length === 0) {
    return "";
  }
  let warmth = 0;
  for (const hex of list.slice(0, 4)) {
    const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) {
      continue;
    }
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    warmth += (r - b) / 255;
  }
  warmth /= Math.max(1, list.length);
  if (warmth > 0.12) {
    return "Timbral bias: warm, amber-leaning harmonics, soft even-order partials.";
  }
  if (warmth < -0.08) {
    return "Timbral bias: cool, blue-leaning spectrum, airy upper partials, less mud in low mids.";
  }
  return "Timbral bias: balanced neutral spectrum with subtle midrange focus.";
}

const ANTI_CLICHE_LINES = [
  "Avoid: generic spa piano, identical 4-note pad loop, and stock rain sound FX.",
  "Avoid: default meditation drone in C major, shallow reverb wash, and predictable chord every 2 bars.",
  "Avoid: copying typical lo-fi hip-hop beat or obvious ukulele strum pattern.",
  "Avoid: cinematic trailer hits, choir swells, and EDM sidechain pumping.",
];

const LYRIA_ARCHETYPES = [
  {
    label: "oceanic ambient",
    sonic: "shimmering high pads, distant wave-like modulation, wide stereo wash",
  },
  {
    label: "warm domestic ambient",
    sonic: "close mic room tone, soft felt piano fragments, gentle tape warmth",
  },
  {
    label: "forest field ambient",
    sonic: "airy wind beds, sparse wooden clicks, filtered bird-like tones (synthetic)",
  },
  {
    label: "nocturnal urban ambient",
    sonic: "low hum, faint distant traffic texture, neon-like soft synth glow",
  },
  {
    label: "minimal crystalline ambient",
    sonic: "glass-like partials, long reverb tails, very sparse notes",
  },
  {
    label: "sunlit pastoral ambient",
    sonic: "muted plucked strings, breezy noise layer, golden harmonic intervals",
  },
  {
    label: "misty drone ambient",
    sonic: "single evolving drone root, slow filter sweeps, sub-bass breath",
  },
  {
    label: "memory haze ambient",
    sonic: "lo-fi hiss, detuned warm chords, nostalgic narrow bandwidth",
  },
];

const LEAD_TEXTURES = [
  "bowed glass harmonics",
  "muted nylon guitar harmonics",
  "soft celeste-like bells",
  "breathy bamboo flute tone",
  "distant thunder rumble (very soft)",
  "vinyl crackle under pad",
  "reverse reverb swells",
  "bowed string sul tasto",
];

/**
 * @param {object} analysis
 * @param {string} [varietySeed]
 */
export function pickLyriaArchetype(analysis, varietySeed = "") {
  const fp = fingerprintAnalysis(analysis, varietySeed);
  const hash = fnv1a(fp);
  const preferred = preferredArchetypeIndex(analysis);
  let idx = hash % LYRIA_ARCHETYPES.length;
  if (preferred !== null) {
    const jitter = varietySeed ? fnv1a(varietySeed) % 2 : hash % 2;
    idx = (preferred + jitter) % LYRIA_ARCHETYPES.length;
  }
  return LYRIA_ARCHETYPES[idx];
}

/**
 * @param {object} analysis
 * @param {string} [varietySeed]
 */
export function pickExtraTexture(analysis, varietySeed = "") {
  const hash = fnv1a(`${fingerprintAnalysis(analysis, varietySeed)}::tex`);
  const instruments = (analysis?.music?.instruments || []).join(" ");
  const extraA = LEAD_TEXTURES[hash % LEAD_TEXTURES.length];
  const extraB = LEAD_TEXTURES[(hash >>> 8) % LEAD_TEXTURES.length];
  if (instruments.length > 8) {
    return `${instruments.slice(0, 100)}; accent: ${extraA}`;
  }
  return `${extraA} and ${extraB}, ${instruments || "evolving pad layers"}`;
}

/** @param {object} analysis @param {string} [varietySeed] */
export function pickAntiClicheLine(analysis, varietySeed = "") {
  const hash = fnv1a(`${fingerprintAnalysis(analysis, varietySeed)}::anti`);
  return ANTI_CLICHE_LINES[hash % ANTI_CLICHE_LINES.length];
}
