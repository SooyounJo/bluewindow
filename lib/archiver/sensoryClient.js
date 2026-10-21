// 브라우저 → pages/api/sensory/* 호출
async function request(path, { body, signal } = {}) {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.hint ? `${json.error}. ${json.hint}` : json.error || `Request failed (${res.status})`);
  return json;
}

export const fetchStatus = signal => request('/api/sensory/status', { signal });

// { imageDataUrl, dominantColors: ['#rrggbb' x5 위→아래], memory } → 팔레트·모션·음악 해석
export const analyzeWindow = (body, signal) => request('/api/sensory/analyze', { body, signal });

// { analysis, imageDataUrl, memory, varietySeed } → { dataUrl } (Lyria mp3)
export const generateMusic = (body, signal) => request('/api/sensory/music', { body, signal });

export const rgbToHex = c => '#' + c.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
export const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
