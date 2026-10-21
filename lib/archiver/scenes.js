// ================= 사진이 없는 공간의 장면 그리기 =================
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}
function glow(ctx, x, y, rx, ry, color, a = 1) {
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function grain(ctx, w, h, amt) {
  const d = ctx.getImageData(0, 0, w, h), p = d.data, r = rng(7);
  for (let i = 0; i < p.length; i += 4) { const n = (r() - 0.5) * amt; p[i] += n; p[i + 1] += n; p[i + 2] += n; }
  ctx.putImageData(d, 0, 0);
}
const SCENES = {
  dawnSea(ctx, w, h, r) {
    ctx.fillStyle = vgrad(ctx, 0, h * 0.58, ['#26315e', '#6f5f9c', '#e79bb0', '#fbd2b1']); ctx.fillRect(0, 0, w, h * 0.58);
    for (let i = 0; i < 9; i++) glow(ctx, r() * w, h * (0.15 + r() * 0.3), 120 + r() * 140, 14 + r() * 16, '#b98fb8', 0.55);
    glow(ctx, w * 0.62, h * 0.57, 120, 70, '#fff1e0', 0.95);
    ctx.fillStyle = vgrad(ctx, h * 0.58, h, ['#8f86b4', '#4a5687', '#1c2442']); ctx.fillRect(0, h * 0.58, w, h);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,220,210,${0.15 + r() * 0.3})`; ctx.fillRect(w * 0.45 + r() * w * 0.35, h * (0.6 + r() * 0.3), 30 + r() * 60, 2); }
  },
  cityRiver(ctx, w, h, r) {
    ctx.fillStyle = vgrad(ctx, 0, h * 0.55, ['#070b1d', '#17214d', '#33356e']); ctx.fillRect(0, 0, w, h * 0.55);
    ctx.fillStyle = '#0b0e1c';
    for (let x = 0; x < w; x += 18 + r() * 30) { const bh = 40 + r() * 140; ctx.fillRect(x, h * 0.55 - bh, 16 + r() * 26, bh); }
    const cols = ['#ffd27a', '#ff8fb1', '#7fd3ff', '#b59bff', '#ffffff'];
    for (let i = 0; i < 120; i++) glow(ctx, r() * w, h * (0.38 + r() * 0.17), 3 + r() * 5, 3 + r() * 5, cols[i % 5], 0.9);
    ctx.fillStyle = vgrad(ctx, h * 0.55, h, ['#1c2150', '#0b0f25', '#04060f']); ctx.fillRect(0, h * 0.55, w, h);
    for (let i = 0; i < 70; i++) { ctx.fillStyle = cols[i % 5]; ctx.globalAlpha = 0.25 + r() * 0.35; ctx.fillRect(r() * w, h * (0.57 + r() * 0.3), 2 + r() * 3, 18 + r() * 60); }
    ctx.globalAlpha = 1;
  },
  mistForest(ctx, w, h, r) {
    ctx.fillStyle = vgrad(ctx, 0, h, ['#dfe6d8', '#a9bea4', '#5f7559', '#25311f']); ctx.fillRect(0, 0, w, h);
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = ['rgba(90,110,85,0.45)', 'rgba(50,66,45,0.7)', 'rgba(24,32,20,0.9)'][layer];
      for (let i = 0; i < 9; i++) { const x = r() * w, tw = 10 + layer * 9 + r() * 10; ctx.fillRect(x, 0, tw, h); }
      glow(ctx, w * 0.5, h * 0.45, w * 0.8, 120, 'rgba(235,240,228,0.8)', 0.6);
    }
    glow(ctx, w * 0.3, h * 0.2, 160, 120, '#fffbe8', 0.7);
    ctx.fillStyle = vgrad(ctx, h * 0.8, h, ['rgba(40,55,30,0)', '#1b2414']); ctx.fillRect(0, h * 0.8, w, h);
  },
  bridgeNight(ctx, w, h, r) {
    ctx.fillStyle = vgrad(ctx, 0, h * 0.6, ['#0d1230', '#253463', '#5a4b84', '#9a6a8f']); ctx.fillRect(0, 0, w, h * 0.6);
    ctx.fillStyle = vgrad(ctx, h * 0.6, h, ['#2b2f5c', '#111633', '#070914']); ctx.fillRect(0, h * 0.6, w, h);
    const cols = ['#58e1ff', '#a77bff', '#ff6fd1', '#58e1ff'];
    for (let i = 0; i <= 60; i++) {
      const x = i / 60 * w, y = h * 0.5 - Math.sin(i / 60 * Math.PI) * 40;
      glow(ctx, x, y, 7, 7, cols[Math.floor(i / 15) % 4], 0.95);
      ctx.fillStyle = cols[Math.floor(i / 15) % 4]; ctx.globalAlpha = 0.25; ctx.fillRect(x - 1, h * 0.62, 3, 40 + r() * 90); ctx.globalAlpha = 1;
    }
    glow(ctx, w * 0.2, h * 0.9, 160, 60, '#ffb36b', 0.5);
  },
  hanokDusk(ctx, w, h, r) {
    ctx.fillStyle = vgrad(ctx, 0, h, ['#f7cf86', '#ee9a57', '#b85a3c', '#4a2420']); ctx.fillRect(0, 0, w, h);
    glow(ctx, w * 0.7, h * 0.42, 140, 110, '#fff0c8', 0.9);
    for (let i = 0; i < 6; i++) glow(ctx, r() * w, h * (0.1 + r() * 0.25), 150, 18, '#f3b98a', 0.5);
    ctx.fillStyle = '#2a1714';
    for (let k = 0; k < 3; k++) {
      const y = h * (0.55 + k * 0.1), x0 = -40 + k * 90;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo(x0 + w * 0.35, y - 50, x0 + w * 0.7, y - 10);
      ctx.lineTo(x0 + w * 0.7, h); ctx.lineTo(x0, h); ctx.closePath(); ctx.fill();
    }
    for (let i = 0; i < 8; i++) glow(ctx, r() * w, h * (0.7 + r() * 0.25), 16, 16, '#ffbe6b', 0.85);
  },
};
export function sceneURL(name, seed) {
  const c = document.createElement('canvas'); c.width = 640; c.height = 800;
  const ctx = c.getContext('2d'), r = rng(seed);
  SCENES[name](ctx, 640, 800, r);
  const c2 = document.createElement('canvas'); c2.width = 640; c2.height = 800;
  const x2 = c2.getContext('2d'); x2.filter = 'blur(3px)'; x2.drawImage(c, 0, 0); x2.filter = 'none';
  grain(x2, 640, 800, 26);
  return c2.toDataURL('image/jpeg', 0.85);
}
