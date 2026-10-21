// ================= 사진에서 색 5개 뽑기 (위 → 아래 순서) =================
export function extractPalette(img, sat = 1.35) {
  const w = 40, h = 50, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, px = [];
  for (let i = 0, n = 0; i < d.length; i += 4, n++) px.push([d[i], d[i + 1], d[i + 2], Math.floor(n / w) / h]);
  const lum = p => p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114;
  const sorted = [...px].sort((a, b) => lum(a) - lum(b));
  let cen = [0.1, 0.3, 0.5, 0.7, 0.92].map(q => sorted[Math.floor(q * (sorted.length - 1))].slice(0, 3));
  let groups;
  for (let it = 0; it < 10; it++) {
    groups = cen.map(() => ({ s: [0, 0, 0], y: 0, n: 0 }));
    for (const p of px) {
      let bi = 0, bd = 1e9;
      cen.forEach((c, i) => { const dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (dd < bd) { bd = dd; bi = i; } });
      const g = groups[bi]; g.s[0] += p[0]; g.s[1] += p[1]; g.s[2] += p[2]; g.y += p[3]; g.n++;
    }
    cen = groups.map((g, i) => g.n ? g.s.map(v => v / g.n) : cen[i]);
  }
  return cen.map((c, i) => {
    // 너무 탁한 색은 채도를 조금 살려 LED에서 또렷하게
    const m = (c[0] + c[1] + c[2]) / 3;
    const boosted = c.map(v => Math.max(0, Math.min(255, m + (v - m) * sat)));
    return { rgb: boosted.map(v => v / 255), y: groups[i].n ? groups[i].y / groups[i].n : i / 4 };
  }).sort((a, b) => a.y - b.y).map(o => o.rgb);
}

// 다섯 색 중 가장 또렷하고 서로 다른 두 색을 골라 위/아래 순서로
export function twoTone(pal) {
  if (pal._two) return pal._two;
  const vivid = c => { const mx = Math.max(...c), mn = Math.min(...c); return (mx - mn) * 0.7 + mx * 0.3; };
  let best = -1, pair = [0, 4];
  for (let i = 0; i < pal.length; i++) for (let j = i + 1; j < pal.length; j++) {
    const a = pal[i], b = pal[j];
    const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const sc = dist * 1.2 + vivid(a) + vivid(b);
    if (sc > best) { best = sc; pair = [i, j]; }
  }
  return (pal._two = [pal[pair[0]], pal[pair[1]]]);
}
