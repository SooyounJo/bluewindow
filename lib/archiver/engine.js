import { FS, VS, BG_FS, mkProg } from './shaders';
import { sceneURL } from './scenes';
import { extractPalette, twoTone } from './palette';
import { createPlaces } from './places';
import { createLedClient, PANEL_W, PANEL_H } from '../ledClient';
import { MEMORY_MAX } from '../sensory/prompt';
import { analyzeWindow, fetchStatus, generateMusic, hexToRgb, rgbToHex } from './sensoryClient';
import { loadRecords, putRecord } from './recordStore';

// pages/index.js 의 마크업이 그려진 뒤 한 번 호출. 반환값은 정리 함수.
export function initArchiver() {
  const life = new AbortController();
  const signal = life.signal;
  const on = (target, type, fn, opts = {}) => target.addEventListener(type, fn, { ...opts, signal });
  let rafId = 0;

  const PLACES = createPlaces();

  // ================= 공용 WebGL 렌더러 =================
  const glc = document.createElement('canvas'); glc.width = 320; glc.height = 640;
  const gl = glc.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false });
  const main = mkProg(gl, VS, FS);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  ['TEXTURE_WRAP_S', 'TEXTURE_WRAP_T'].forEach(k => gl.texParameteri(gl.TEXTURE_2D, gl[k], gl.CLAMP_TO_EDGE));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(main.u('photo'), 0);
  let texAspect = 0.8;

  function setPhotoTexture(img) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    texAspect = img.naturalWidth / img.naturalHeight;
  }
  // 그리기: 공용 캔버스의 왼쪽 아래 (w x h) 영역에
  function draw(w, h, P) {
    gl.viewport(0, 0, w, h);
    const U = main.u;
    gl.uniform2f(U('r'), w, h);
    gl.uniform1f(U('t'), P.t); gl.uniform1f(U('spin'), P.spin);
    gl.uniform1f(U('soft'), P.soft); gl.uniform1f(U('sharp'), P.sharp);
    gl.uniform1f(U('rimAmt'), P.rim); gl.uniform1f(U('photoMix'), P.photo || 0);
    gl.uniform1f(U('dissolve'), P.dissolve || 0);
    gl.uniform1f(U('motion'), P.motion || 0);
    gl.uniform1f(U('edgeGlow'), P.edge || 0);
    gl.uniform1f(U('vivid'), P.vivid || 1);
    gl.uniform1f(U('amp'), P.amp || 1);
    gl.uniform1f(U('energy'), P.energy || 0);
    gl.uniform1f(U('pulse'), P.pulse || 0);
    gl.uniform1f(U('shift'), P.shift || 0);
    P.pal.forEach((c, i) => gl.uniform3f(U('c' + i), c[0], c[1], c[2]));
    const TT = P.two || twoTone(P.pal);
    gl.uniform3f(U('tA'), ...TT[0]); gl.uniform3f(U('tB'), ...TT[1]);
    gl.uniform1f(U('tone'), P.tone || 0);
    // 사진을 화면 비율에 꽉 차게 (cover)
    const A = w / h; let sx = 1, sy = 1;
    if (texAspect > A) sx = A / texAspect; else sy = texAspect / A;
    gl.uniform4f(U('pr'), (1 - sx) / 2, (1 - sy) / 2, sx, sy);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function blit(ctx, w, h) {   // 공용 캔버스 → 화면 캔버스
    ctx.drawImage(glc, 0, glc.height - h, w, h, 0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  // ================= 랜딩 배경 =================
  const bg = document.getElementById('bg');
  const bgl = bg.getContext('webgl');
  const bgp = mkProg(bgl, VS, BG_FS);
  function sizeBg() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    bg.width = Math.round(window.innerWidth * dpr); bg.height = Math.round(window.innerHeight * dpr);
  }
  on(window, 'resize', sizeBg); sizeBg();

  // ================= 화면 전환 =================
  const $ = id => document.getElementById(id);
  let screen = 'landing';
  function go(name) {
    if (name !== screen) stopMusic();
    if (name === 'record' && rec.img) setPhotoTexture(rec.img);
    screen = name;
    dialDirty = true;
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === name));
    window.scrollTo(0, 0);
  }
  $('startBtn').onclick = () => { go('library'); if (!hot) setBackground(null); };
  $('archiveBtn').onclick = () => go('record');
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));

  // ================= 라이브러리 (스크롤로 도는 원형 링) =================
  function loadPlaceImage(pl) {
    const img = new Image();
    img.onload = () => {
      if (!pl.pal) pl.pal = pl.palette ? pl.palette.map(hexToRgb) : extractPalette(img, pl.sat);
      pl.img = img;
    };
    img.src = pl.photo;
  }
  PLACES.forEach(pl => {
    const ORIG = ['road', 'anmok', 'ttuk', 'sevensisters', 'gwangan', 'jeonju'].indexOf(pl.id);
    if (!pl.photo) pl.photo = sceneURL(pl.scene, 1234 + ORIG * 977);
    loadPlaceImage(pl);
  });

  let SLOTS = 18;                         // 공간들을 반복해서 링을 채움
  const ring = $('ring');
  let slots = [];
  let hot = null, tapped = null;
  function buildRing() {
    ring.innerHTML = ''; slots = [];
    const reps = Math.max(2, Math.ceil(18 / PLACES.length));
    SLOTS = PLACES.length * reps;
    for (let k = 0; k < SLOTS; k++) {
      const pl = PLACES[k % PLACES.length];
      const el = document.createElement('button');
      el.className = 'item';
      el.setAttribute('aria-label', pl.name + ', ' + pl.date + (pl.disabled ? ' (not available)' : ''));
      el.innerHTML = '<canvas width="168" height="168"></canvas>';
      if (pl.disabled) { el.classList.add('off'); el.setAttribute('aria-disabled', 'true'); }
      const slot = { el, pl, ctx: el.querySelector('canvas').getContext('2d'), tilt: (Math.sin(k * 12.9898) * 43758.5 % 1) * 14 - 7, vis: true };
      el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') setHot(slot); });
      el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && hot === slot) setHot(null); });
      el.addEventListener('focus', () => setHot(slot));
      el.addEventListener('click', e => {
        if (dragMoved) { e.preventDefault(); return; }
        if (pl.disabled) { setHot(slot); return; }
        // 터치: 처음 탭은 미리보기, 한 번 더 탭하면 들어감
        if (lastPointerType !== 'mouse' && tapped !== slot) { tapped = slot; setHot(slot); return; }
        openPlace(pl);
      });
      ring.appendChild(el);
      slots.push(slot);
    }
  }
  buildRing();

  // 지난번에 Record로 저장해 둔 창들을 링 앞쪽에 복원
  loadRecords().then(rows => {
    if (signal.aborted || !rows.length) return;
    const known = new Set(PLACES.map(p => p.id));
    const fresh = rows.filter(r => !known.has(r.id));
    fresh.forEach(loadPlaceImage);
    PLACES.unshift(...fresh);
    buildRing(); setHot(null);
  }).catch(err => console.error('Saved records could not be loaded:', err));

  // 배경: 랜딩과 같은 물결 배경, 색만 호버한 블록에 맞춰 천천히 바뀜
  const rgb = (c, k = 1, a = 1) => `rgba(${c.map(v => Math.round(Math.min(1, v * k) * 255)).join(',')},${a})`;
  const LANDING_SKY = [0.471, 0.718, 0.890], LANDING_LOW = [0.30, 0.42, 0.52];
  const bgNow = { sky: [...LANDING_SKY], low: [...LANDING_LOW], amt: 1 };
  let bgTarget = { sky: LANDING_SKY, low: LANDING_LOW, amt: 1 };
  function setBackground(pl) {
    if (!pl || !pl.pal) { bgTarget = { sky: bgNow.sky, low: bgNow.low, amt: 0 }; return; }
    const [A, B] = twoTone(pl.pal);
    // 블록 색이 은은하게 비치는 정도로만: 채도를 덜고 어둡게 가라앉힌 뒤 검은 배경 위에 반쯤 섞음
    const mute = (c, light) => {
      const mx = Math.max(...c, 0.05), n = c.map(v => v / mx);
      const g = (n[0] + n[1] + n[2]) / 3;
      return n.map(v => (g + (v - g) * 0.55) * light);
    };
    bgTarget = { sky: mute(A, 0.42), low: mute(B, 0.2), amt: 0.6 };
  }
  function setHot(slot) {
    if (hot) hot.el.classList.remove('hot');
    hot = slot;
    const info = $('info');
    if (!slot) {
      tapped = null; setBackground(null);
      info.innerHTML = '<div class="fade hello">SCROLL TO EXPLORE</div>';
      return;
    }
    const pl = slot.pl;
    slot.el.classList.add('hot');
    if (pl.pal) slot.el.style.setProperty('--glow', rgb(twoTone(pl.pal)[1], 1, 0.7));
    setBackground(pl);
    info.innerHTML = `<div class="fade"><div class="nm">${pl.name}</div><div class="dt">${pl.date}</div>
      <div class="mm">${pl.memory}</div>${pl.disabled ? '<span class="tag">COMING SOON</span>' : ''}</div>`;
  }
  setHot(null);

  // 스크롤·드래그로 링 회전
  let rot = 0, rotTarget = 0, dragMoved = false, lastPointerType = 'mouse';
  on(ring, 'wheel', e => { e.preventDefault(); rotTarget += (e.deltaY + e.deltaX) * 0.0011; }, { passive: false });
  let dragX = null, dragStartRot = 0;
  on(ring, 'pointerdown', e => {
    lastPointerType = e.pointerType; dragX = e.clientX; dragStartRot = rotTarget; dragMoved = false;
  });
  on(window, 'pointermove', e => {
    if (dragX === null) return;
    const dx = e.clientX - dragX;
    if (Math.abs(dx) > 6) { dragMoved = true; ring.classList.add('dragging'); }
    if (dragMoved) rotTarget = dragStartRot - dx * 0.0035;
  });
  on(window, 'pointerup', () => { dragX = null; ring.classList.remove('dragging'); setTimeout(() => dragMoved = false, 0); });
  on(window, 'keydown', e => {
    if (screen !== 'library') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') rotTarget += 0.25;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') rotTarget -= 0.25;
  });

  function layoutRing(dt) {
    rot += (rotTarget - rot) * Math.min(1, dt * 6);
    const W = window.innerWidth, H = window.innerHeight;
    const size = slots[0].el.offsetWidth || 140;
    const R = W < 700 ? W * 0.95 : Math.max(H * 0.78, W * 0.52);
    const cx = W / 2, cy = H * 0.3 + R;
    const step = Math.min(0.55, (size * 1.6) / R);
    const span = step * SLOTS;
    for (let k = 0; k < SLOTS; k++) {
      let a = k * step - rot;
      a = ((a % span) + span * 1.5) % span - span / 2;          // 끝없이 이어지도록 감기
      const x = cx + R * Math.sin(a), y = cy - R * Math.cos(a);
      const vis = y < H + size && Math.abs(a) < 1.7;
      const sl = slots[k];
      sl.vis = vis;
      sl.el.style.visibility = vis ? 'visible' : 'hidden';
      if (!vis) continue;
      const sc = 1 - Math.min(0.22, Math.abs(a) * 0.18) + (sl === hot ? 0.08 : 0);
      sl.el.style.transform = `translate(${x}px, ${y}px) rotate(${a * 57.3 + sl.tilt}deg) scale(${sc})`;
      sl.el.style.zIndex = sl === hot ? 3 : 1;
    }
  }

  // ================= 사운드 =================
  // 흐림 → 리버브가 커지고, 고음이 걷히고, 좌우가 한가운데로 모임
  // 뚜렷함 → 원본 소리 그대로
  let actx = null, A = null, src = null, musicOn = false, muted = false, playing = null;
  function ensureAudio() {
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      const c = actx;
      const input = c.createGain();
      const split = c.createChannelSplitter(2), merge = c.createChannelMerger(2);
      const ll = c.createGain(), lr = c.createGain(), rl = c.createGain(), rr = c.createGain();
      input.connect(split);
      split.connect(ll, 0); split.connect(lr, 0); split.connect(rl, 1); split.connect(rr, 1);
      ll.connect(merge, 0, 0); rl.connect(merge, 0, 0); lr.connect(merge, 0, 1); rr.connect(merge, 0, 1);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.4;
      merge.connect(lp);
      const conv = c.createConvolver(); conv.buffer = impulse(c, 7.0, 2.0);
      const dry = c.createGain(), wet = c.createGain();
      lp.connect(dry); lp.connect(conv); conv.connect(wet);
      const master = c.createGain(); master.gain.value = 0;
      dry.connect(master); wet.connect(master); master.connect(c.destination);
      const an = c.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = 0.5;
      input.connect(an);                                  // 효과 전 원음으로 리듬 분석
      A = { input, ll, lr, rl, rr, lp, dry, wet, master, an,
            fbuf: new Uint8Array(an.frequencyBinCount), prev: new Uint8Array(an.frequencyBinCount) };
      applySoundClarity(true);
    }
    if (actx.state === 'suspended') actx.resume();
  }
  function impulse(c, sec, decay) {
    const n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return b;
  }
  function applySoundClarity(now) {
    if (!A) return;
    const b = 1 - sharp;                         // 흐림 정도 0~1
    const w = 1 - b;                             // 스테레오 폭 (0 = 한가운데로 모임)
    const T = actx.currentTime, tc = now ? 0.01 : 0.12;
    const set = (param, v) => param.setTargetAtTime(v, T, tc);
    set(A.ll.gain, (1 + w) / 2); set(A.rr.gain, (1 + w) / 2);
    set(A.lr.gain, (1 - w) / 2); set(A.rl.gain, (1 - w) / 2);
    set(A.lp.frequency, 20000 * Math.pow(0.028, b));        // 20kHz → 약 560Hz
    const bw = Math.pow(b, 0.7);                 // 조금만 흐려도 리버브가 빨리 차오르게
    set(A.dry.gain, Math.cos(b * Math.PI / 2 * 0.97));
    set(A.wet.gain, bw * 2.1);
  }
  function decodeFor(pl) {
    if (pl.buffer || pl.decoding || !pl.audio) return;
    pl.decoding = true;
    fetch(pl.audio)
      .then(res => res.arrayBuffer())
      .then(data => actx.decodeAudioData(data))
      .then(buf => prepareTrack(pl, buf))
      .catch(err => { pl.decoding = false; console.error(err); });
  }
  function prepareTrack(pl, buf) {
    // mp3 앞뒤의 빈 구간을 빼고 자연스럽게 반복
    const d = buf.getChannelData(0); let a = 0, z = d.length - 1;
    while (a < d.length && Math.abs(d[a]) < 0.0005) a++;
    while (z > a && Math.abs(d[z]) < 0.0005) z--;
    pl.buffer = buf; pl.loopA = a / buf.sampleRate; pl.loopZ = z / buf.sampleRate;
    pl.bpm = estimateBPM(buf);
  }
  // 곡 전체를 한 번 훑어 빠르기(BPM) 추정: 세기 변화의 자기상관
  function estimateBPM(buf) {
    const d = buf.getChannelData(0), sr = buf.sampleRate, hop = 512, n = Math.floor(d.length / hop);
    const env = new Float32Array(n);
    for (let i = 0; i < n; i++) { let s2 = 0; for (let j = i * hop; j < (i + 1) * hop; j++) s2 += d[j] * d[j]; env[i] = Math.sqrt(s2 / hop); }
    const on = new Float32Array(n); let mean = 0;
    for (let i = 1; i < n; i++) { on[i] = Math.max(0, env[i] - env[i - 1]); mean += on[i]; }
    mean /= n; for (let i = 0; i < n; i++) on[i] -= mean;
    let best = 0, bestLag = 1;
    const l0 = Math.floor(0.3 * sr / hop), l1 = Math.floor(1.5 * sr / hop);
    for (let L = l0; L <= l1; L++) { let c = 0; for (let i = 0; i + L < n; i++) c += on[i] * on[i + L]; if (c > best) { best = c; bestLag = L; } }
    let bpm = 60 / (bestLag * hop / sr);
    while (bpm > 150) bpm /= 2;
    while (bpm < 70) bpm *= 2;
    return bpm;
  }
  function startMusic(pl) {
    if (!pl.buffer || musicOn) return;
    src = actx.createBufferSource();
    src.buffer = pl.buffer; src.loop = true;
    src.loopStart = pl.loopA; src.loopEnd = pl.loopZ;
    src.connect(A.input);
    src.start(0, pl.loopA);
    feat.ref = -1;
    musicOn = true; playing = pl;
    A.master.gain.cancelScheduledValues(actx.currentTime);
    A.master.gain.setTargetAtTime(muted ? 0 : 0.9, actx.currentTime, 0.9);   // 천천히 페이드 인
  }
  function stopMusic() {
    if (!src) { musicOn = false; return; }
    const s0 = src; src = null; musicOn = false;
    A.master.gain.cancelScheduledValues(actx.currentTime);
    A.master.gain.setTargetAtTime(0, actx.currentTime, 0.08);
    setTimeout(() => { try { s0.stop(); } catch (e) {} }, 400);
  }
  $('soundBtn').onclick = () => {
    muted = !muted;
    $('soundBtn').textContent = muted ? 'Sound off' : 'Sound on';
    if (musicOn) A.master.gain.setTargetAtTime(muted ? 0 : 0.9, actx.currentTime, 0.15);
  };

  // ================= 상세 =================
  let cur = null, seqStart = 0, spin = 0, simT = 0;
  let sharp = 0.55;
  const pctx = $('pGL').getContext('2d');
  const PHASES = [
    { until: 1.8, label: 'The light, as it was' },
    { until: 5.0, label: 'Colors dissolving' },
    { until: 8.6, label: 'Light gathering at the edges' },
    { until: 11.8, label: 'Beginning to ripple' },
    { until: Infinity, label: 'Window' },
  ];
  function openPlace(pl) {
    if (!pl.img) return;
    cur = pl;
    $('pName').textContent = pl.name;
    $('pSub').textContent = pl.date;
    $('pImg').src = pl.photo;
    $('pImg').alt = 'Photo of ' + pl.name;
    $('pMemory').textContent = pl.memory;
    setPhotoTexture(pl.img);
    if (pl.clarity != null) setSharp(pl.clarity);   // 기록한 창은 저장할 때의 선명도로 시작
    ensureAudio();
    decodeFor(pl);
    $('dialHint').textContent = pl.audio
      ? 'Blur gathers the light at the edges and folds the sound into reverb. Clarity releases both.'
      : 'Blur gathers the light at the edges. Clarity lets it flow freely again.';
    replay();
    go('detail');
  }
  let musicArmed = false;
  function replay() { stopMusic(); seqStart = performance.now(); spin = 0; musicArmed = true; smoothSoft = 1; smoothRim = 0; }
  $('replay').onclick = replay;

  $('swapBtn').onclick = () => $('fileIn').click();
  $('fileIn').onchange = e => {
    const f = e.target.files[0]; if (!f || !cur) return;
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => { cur.photo = rd.result; cur.img = img; cur.pal = extractPalette(img, cur.sat); openPlace(cur); };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
    e.target.value = '';
  };

  const ease = k => { k = Math.min(Math.max(k, 0), 1); return k * k * (3 - 2 * k); };
  function sequence(e) {
    const [p0, p1, p2, p3] = PHASES.map(p => p.until);
    if (e < p0) return { photo: 1, dissolve: 0, soft: 1, rim: 0, spinSpeed: 0.05 };
    if (e < p1) {
      const k = (e - p0) / (p1 - p0);
      return { photo: 1 - ease((k - 0.2) / 0.8), dissolve: ease(k), soft: 1, rim: ease(k), spinSpeed: 0.05 + 0.25 * k };
    }
    if (e < p2) return { photo: 0, dissolve: 1, soft: 1, rim: 1, spinSpeed: 0.3 };
    // 다이얼과 연결: 흐릴수록 빛이 외곽에 맺혀 흐르고, 또렷할수록 풀려서 원래 물결로 흐름
    const blur = 1 - sharp;
    const breathe = 0.06 * Math.sin(e * 0.55);
    const tSoft = Math.min(1, Math.max(0, 0.12 + 0.88 * Math.pow(blur, 0.8) + breathe * blur));
    const tRim = 0.2 + 0.8 * Math.pow(blur, 0.7);
    const tSpin = 0.06 + 0.22 * blur;
    if (e < p3) {
      const k = ease((e - p2) / (p3 - p2));
      return { photo: 0, dissolve: 1, soft: 1 + (tSoft - 1) * k, rim: 1 + (tRim - 1) * k, spinSpeed: 0.3 + (tSpin - 0.3) * k };
    }
    return { photo: 0, dissolve: 1, soft: tSoft, rim: tRim, spinSpeed: tSpin };
  }

  // ================= 기록 (Record): 사진 + 기억 → AI 해석 → 스스로 변하는 창 + Lyria 음악 =================
  // 사진을 넣으면 창 변환이 바로 시작되고, AI 해석(팔레트·모션)이 오면 창이 그쪽으로 천천히 옮겨감
  // 음악은 Generate music 을 누를 때만 새로 만듦
  const rec = { img: null, photo: null, basePal: null, pal: null, palTarget: null, motion: 0, vivid: 1,
    start: 0, running: false, t: 0, spin: 0, soft: 1, rim: 0, done: false,
    analysis: null, track: null, composing: false };
  const rctx = $('rGL').getContext('2d');
  const api = { visionReady: false, lyriaReady: false };
  let analyzeSeq = 0, analyzeTimer = 0;
  fetchStatus(signal).then(s => { Object.assign(api, s); updateMusicButton(); }).catch(() => {});

  // 화면에는 문제가 생겼을 때만 짧게 알림
  function showError(text = '') {
    const el = $('rNote');
    el.hidden = !text;
    el.textContent = text;
  }
  (function initRecord() {
    const d = new Date();
    $('rDate').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    $('rMemory').oninput = () => { $('rCount').textContent = `${$('rMemory').value.length} / ${MEMORY_MAX}`; validate(); scheduleAnalyze(); };
    $('rName').oninput = validate;
    $('rFile').onchange = e => { if (e.target.files[0]) loadRecordFile(e.target.files[0]); e.target.value = ''; };
    const drop = $('drop');
    on(drop, 'dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    on(drop, 'dragleave', () => drop.classList.remove('over'));
    on(drop, 'drop', e => {
      e.preventDefault(); drop.classList.remove('over');
      const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
      if (f) loadRecordFile(f);
    });
    // Ctrl+V: 클립보드에 이미지가 있을 때만 가로챔 (글자 붙여넣기는 그대로)
    on(window, 'paste', e => {
      if (screen !== 'record' || !e.clipboardData) return;
      const item = [...e.clipboardData.items].find(it => it.kind === 'file' && it.type.startsWith('image/'));
      const f = item && item.getAsFile();
      if (!f) return;
      e.preventDefault();
      loadRecordFile(f);
    });
    $('rMusic').onclick = composeMusic;
    $('rSave').onclick = saveRecord;
  })();
  function validate() {
    $('rSave').disabled = !(rec.done && rec.img && $('rName').value.trim()) || rec.composing;
  }
  function updateMusicButton() {
    const b = $('rMusic');
    b.disabled = !rec.analysis || rec.composing || !api.lyriaReady;
    b.textContent = rec.composing ? 'Composing… (30s–1min)' : rec.track ? 'Generate again' : 'Generate music';
  }
  function scheduleAnalyze() {
    clearTimeout(analyzeTimer);
    if (rec.img) analyzeTimer = setTimeout(analyzeRecord, 1200);
  }
  // 사진과 기억이 모두 있어야 창 변환·AI 해석을 시작함
  async function analyzeRecord() {
    clearTimeout(analyzeTimer);
    const memory = $('rMemory').value.trim();
    if (!rec.img || !memory) return;
    if (!rec.running) {
      rec.start = performance.now(); rec.running = true; rec.done = false; rec.spin = 0; rec.soft = 1; rec.rim = 0;
    }
    const seq = ++analyzeSeq;
    showError();
    try {
      const a = await analyzeWindow({
        imageDataUrl: rec.photo,
        dominantColors: rec.basePal.map(rgbToHex),
        memory,
      }, signal);
      if (seq !== analyzeSeq || !rec.img) return;
      rec.analysis = a;
      if (a.paletteHex.length === 5) {
        // AI 색을 중심으로, 사진 본래 색을 조금 남겨 같은 색 계열을 유지
        rec.palTarget = a.paletteHex.map(hexToRgb).map((c, i) => c.map((v, k) => v * 0.65 + rec.basePal[i][k] * 0.35));
      }
      rec.motion = a.motion;
      setSharp(a.clarity);
      rec.vivid = a.vivid;
    } catch (e) {
      if (signal.aborted || seq !== analyzeSeq) return;
      showError(e.message + ' Using the photo’s own colors.');
    }
    updateMusicButton();
  }
  async function composeMusic() {
    if (!rec.analysis || rec.composing) return;
    ensureAudio();
    const forImg = rec.img;
    rec.composing = true; updateMusicButton(); validate();
    try {
      const { dataUrl } = await generateMusic({
        analysis: rec.analysis,
        imageDataUrl: rec.photo,
        memory: $('rMemory').value.trim(),
        varietySeed: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      }, signal);
      const buf = await actx.decodeAudioData(await (await fetch(dataUrl)).arrayBuffer());
      if (rec.img !== forImg) return;
      const track = { audio: dataUrl };
      prepareTrack(track, buf);
      rec.track = track;
      if (screen === 'record') { stopMusic(); startMusic(track); }
    } catch (e) {
      if (!signal.aborted) showError(e.message);
    } finally {
      rec.composing = false; updateMusicButton(); validate();
    }
  }
  function loadRecordFile(file) {
    const rd = new FileReader();
    rd.onload = () => {
      const src = new Image();
      src.onload = () => {
        // 큰 사진은 줄여서 가볍게
        const k = Math.min(1, 1100 / Math.max(src.naturalWidth, src.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(src.naturalWidth * k); c.height = Math.round(src.naturalHeight * k);
        c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/jpeg', 0.86);
        const img = new Image();
        img.onload = () => {
          stopMusic();
          rec.img = img; rec.photo = url; rec.basePal = rec.pal = extractPalette(img); rec.palTarget = null;
          rec.vivid = 1; rec.analysis = null; rec.track = null;
          analyzeSeq++; rec.running = false; rec.done = false; showError();
          $('rImg').src = url; $('rImg').hidden = false; $('dropMsg').hidden = true; $('drop').classList.add('has');
          $('panelMsg').hidden = true;
          setPhotoTexture(img);
          validate(); updateMusicButton();
          analyzeRecord();
        };
        img.src = url;
      };
      src.src = rd.result;
    };
    rd.readAsDataURL(file);
  }
  function saveRecord() {
    const name = $('rName').value.trim();
    if (!name || !rec.img) return;
    const [y, m, d] = ($('rDate').value || '').split('-');
    const t = rec.track;
    const pl = {
      id: 'rec' + Date.now(), savedAt: Date.now(), motion: rec.motion, vivid: rec.vivid, clarity: Math.round(sharp * 100), name,
      date: y ? `${y}.${m}.${d}` : '',
      memory: $('rMemory').value.trim() || 'A place worth keeping.',
      photo: rec.photo, img: rec.img, pal: rec.palTarget || rec.pal,
      ...(t ? { audio: t.audio, buffer: t.buffer, loopA: t.loopA, loopZ: t.loopZ, bpm: t.bpm } : {}),
    };
    PLACES.unshift(pl);              // 새 기록을 링의 맨 앞에
    putRecord(pl).catch(err => console.error('Record could not be saved:', err));
    buildRing();
    rot = rotTarget = 0;
    go('library');
    setHot(slots[0]);
    // 폼 비우기
    analyzeSeq++; clearTimeout(analyzeTimer);
    Object.assign(rec, { img: null, running: false, done: false, analysis: null, track: null, palTarget: null, vivid: 1 });
    $('rImg').hidden = true; $('dropMsg').hidden = false; $('drop').classList.remove('has'); $('panelMsg').hidden = false;
    $('rName').value = ''; $('rMemory').value = ''; $('rCount').textContent = `0 / ${MEMORY_MAX}`;
    showError();
    updateMusicButton(); $('rSave').disabled = true;
    rctx.clearRect(0, 0, 320, 640);
  }

  // ================= 다이얼 (뚜렷함) =================
  const A0 = -135, A1 = 135;          // 다이얼이 도는 범위
  // 하드웨어 노브: 바깥 점 눈금이 값만큼 켜지고, 가운데 노브의 지시선이 값 방향을 가리킴
  // 상세 화면과 Record 화면에 같은 다이얼이 하나씩 있고, 둘 다 같은 선명도(sharp)를 가리킴
  const DIALS = [
    { el: $('dial'), ctx: $('dialCanvas').getContext('2d'), val: $('dialVal') },
    { el: $('rDial'), ctx: $('rDialCanvas').getContext('2d'), val: $('rDialVal') },
  ];
  let dialAng = 0, dialDirty = true;
  const TICKS = 29;
  function drawDial(dctx) {
    const W = 440, c = W / 2;
    const a = dialAng * Math.PI / 180;
    const at = (th, r) => [c + Math.sin(th) * r, c - Math.cos(th) * r];   // 위쪽 0, 시계 방향 +
    dctx.clearRect(0, 0, W, W);

    // 바탕 원판 (평평한 단색)
    dctx.fillStyle = '#18181a';
    dctx.beginPath(); dctx.arc(c, c, 216, 0, Math.PI * 2); dctx.fill();

    // 점 눈금: 값까지는 흰 점, 그 뒤는 어두운 점 (경계 점은 부드럽게)
    const lit = sharp * (TICKS - 1);
    for (let i = 0; i < TICKS; i++) {
      const th = (A0 + (A1 - A0) * i / (TICKS - 1)) * Math.PI / 180;
      const [x, y] = at(th, 192);
      const k = Math.min(1, Math.max(0, lit - i + 1));
      dctx.fillStyle = `rgba(255,255,255,${0.12 + 0.83 * k})`;
      dctx.beginPath(); dctx.arc(x, y, 3.4, 0, Math.PI * 2); dctx.fill();
    }

    // 노브: 그림자·그라데이션 없는 어두운 단색 원 + 얇은 테두리 링
    dctx.fillStyle = '#0f0f11';
    dctx.beginPath(); dctx.arc(c, c, 160, 0, Math.PI * 2); dctx.fill();
    dctx.strokeStyle = 'rgba(255,255,255,0.08)'; dctx.lineWidth = 2;
    dctx.beginPath(); dctx.arc(c, c, 159, 0, Math.PI * 2); dctx.stroke();

    // 지시선
    const [x0, y0] = at(a, 104), [x1, y1] = at(a, 134);
    dctx.strokeStyle = '#ffffff'; dctx.lineWidth = 6; dctx.lineCap = 'round';
    dctx.beginPath(); dctx.moveTo(x0, y0); dctx.lineTo(x1, y1); dctx.stroke();
  }
  function setSharp(v) {
    v = Math.round(Math.min(100, Math.max(0, v)));
    sharp = v / 100;
    dialAng = A0 + (A1 - A0) * sharp;
    dialDirty = true;
    DIALS.forEach(d => { d.val.textContent = v; d.el.setAttribute('aria-valuenow', v); });
    applySoundClarity(false);
  }
  setSharp(55);
  // 잡고 돌리는 만큼만 회전 (상대 회전)
  DIALS.forEach(({ el }) => {
    let dragging = false, lastAng = 0;
    const pointerAngle = e => {
      const b = el.getBoundingClientRect();
      return Math.atan2(e.clientX - (b.left + b.width / 2), -(e.clientY - (b.top + b.height / 2))) * 180 / Math.PI;
    };
    on(el, 'pointerdown', e => { dragging = true; el.setPointerCapture(e.pointerId); lastAng = pointerAngle(e); });
    on(el, 'pointermove', e => {
      if (!dragging) return;
      const ang = pointerAngle(e);
      let d = ang - lastAng; if (d > 180) d -= 360; if (d < -180) d += 360;
      lastAng = ang;
      setSharp(sharp * 100 + d / (A1 - A0) * 100);
    });
    on(el, 'pointerup', () => dragging = false);
    on(el, 'pointercancel', () => dragging = false);
    on(el, 'wheel', e => { e.preventDefault(); setSharp(sharp * 100 - Math.sign(e.deltaY) * 3); }, { passive: false });
    on(el, 'keydown', e => {
      const step = { ArrowUp: 2, ArrowRight: 2, ArrowDown: -2, ArrowLeft: -2, PageUp: 10, PageDown: -10 }[e.key];
      if (step) { e.preventDefault(); setSharp(sharp * 100 + step); }
    });
  });

  // ================= LED 패널 전송 =================
  // 화면의 세로 창(32×64)을 90° 돌려 가로 패널(64×32)에 맞춤
  const W = 32, H = 64, PW = PANEL_W, PH = PANEL_H;
  const small = document.createElement('canvas'); small.width = W; small.height = H;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  const out = new Uint8Array(PW * PH * 3);
  let clockwise = true, lastSend = 0;
  const status = h => $('status').innerHTML = h;
  const led = createLedClient({
    onOpen: url => {
      $('connect').textContent = 'Disconnect';
      status(`<b class="ok">Connected</b> ${url}`);
      led.setBrightness(60);
    },
    onClose: () => {
      $('connect').textContent = 'Connect';
      status('<b class="bad">Disconnected.</b> Check that the server is running, both devices are on the same Wi-Fi, and the IP is correct.');
    },
  });
  $('panelBtn').onclick = () => { const open = $('sheet').classList.toggle('on'); $('panelBtn').setAttribute('aria-expanded', open); };
  $('rotate').onclick = () => { clockwise = !clockwise; $('rotate').textContent = `Rotate: ${clockwise ? 'CW' : 'CCW'} 90°`; };
  $('connect').onclick = () => {
    if (led.active) { led.disconnect(); return; }
    const url = led.connect($('host').value.trim());
    status(`Connecting to ${url}…`);
  };
  function sendFrame() {
    sctx.drawImage(glc, 0, glc.height - 640, 320, 640, 0, 0, W, H);
    const d = sctx.getImageData(0, 0, W, H).data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = clockwise ? (H - 1 - y) : y, py = clockwise ? x : (W - 1 - x);
      const si = (y * W + x) * 4, di = (py * PW + px) * 3;
      out[di] = d[si]; out[di + 1] = d[si + 1]; out[di + 2] = d[si + 2];
    }
    led.sendFrame(out);
  }

  // ================= 음악 리듬 분석 =================
  // energy: 전체 세기, pulse: 저음 비트 순간, tempo: 비트 간격으로 추정한 빠르기 배율
  const feat = { mel: 0, mel1: 0, pitch: 0.45, tempo: 1, ref: 0.15, pAvg: 0.45, shift: 0, shift1: 0, hit: 0, fluxAvg: 0.01 };
  // 음악이 창에 주는 영향: 멜로디 세기(mel)는 느린 흐름, 맥박(hit)은 순간 반응
  const musicMod = (F, soft, rim) => ({
    soft: Math.max(0, soft * (1 - 0.35 * F.mel - 0.25 * F.hit)),   // 소리가 차오르면 디테일이 드러남
    rim: rim * (1 + 0.35 * F.mel + 0.3 * F.hit),
    speed: 0.8 + 0.9 * F.mel + 0.6 * F.hit,
  });
  // 킥(저음)이 아니라 멜로디 대역(약 300Hz~3kHz)을 따라감: 세기는 부드럽게, 음높이는 색의 흐름으로
  function readAudio(dt) {
    if (!musicOn || !A || muted) {
      feat.mel1 *= Math.exp(-dt * 0.8); feat.mel += (feat.mel1 - feat.mel) * Math.min(1, dt * 0.8);
      feat.pitch += (0.5 - feat.pitch) * Math.min(1, dt * 0.8);
      feat.shift1 *= Math.exp(-dt * 0.6); feat.shift += (feat.shift1 - feat.shift) * Math.min(1, dt * 0.6);
      feat.hit *= Math.exp(-dt * 3.5);
      feat.tempo += (1 - feat.tempo) * Math.min(1, dt); return feat;
    }
    const bpm = (playing && playing.bpm) || 100;
    feat.tempo += (Math.min(1.35, Math.max(0.7, bpm / 105)) - feat.tempo) * Math.min(1, dt * 2);
    A.an.getByteFrequencyData(A.fbuf);
    const hz = actx.sampleRate / A.an.fftSize;
    const i0 = Math.round(300 / hz), i1 = Math.round(3000 / hz);
    let e = 0, wsum = 0, csum = 0;
    for (let i = i0; i <= i1; i++) {
      const m = A.fbuf[i] / 255; e += m;
      const w = m * m; wsum += w; csum += w * Math.log2(i * hz / 300);   // 로그 스케일 음높이
    }
    e /= (i1 - i0 + 1);
    const pitch = wsum > 1e-4 ? Math.min(1, csum / wsum / Math.log2(10)) : feat.pitch;
    // 곡마다 음량이 달라서, 최근 평균 대비 얼마나 차오르는지로 판단 (자동 레벨 맞춤)
    if (feat.ref < 0) { feat.ref = Math.max(e, 0.02); feat.pAvg = pitch; feat.pitch = pitch; }   // 곡 시작 시 기준 맞춤
    feat.ref += (e - feat.ref) * Math.min(1, dt * (e > feat.ref ? 0.45 : 0.25));   // 최근 몇 초의 기준 세기
    // 평균 대비 차오름을 0.5 중심 곡선으로
    const rel = Math.min(1, Math.max(0, 0.5 + (e / Math.max(feat.ref, 0.02) - 1) * 1.1));
    // 두 단계로 걸러서, 1초 안쪽으로 따라감
    feat.mel1 += (rel - feat.mel1) * Math.min(1, dt * 2.4);
    feat.mel += (feat.mel1 - feat.mel) * Math.min(1, dt * 2.4);
    feat.pitch += (pitch - feat.pitch) * Math.min(1, dt * 1.2);
    feat.pAvg += (feat.pitch - feat.pAvg) * Math.min(1, dt * 0.08);
    feat.shift1 += (Math.max(-0.22, Math.min(0.22, (feat.pitch - feat.pAvg) * 3)) - feat.shift1) * Math.min(1, dt * 1.2);
    feat.shift += (feat.shift1 - feat.shift) * Math.min(1, dt * 1.2);
    // 맥박: 직전 프레임보다 스펙트럼이 얼마나 솟았는지(onset). 최근 평균보다 확실히 클 때만 반응
    const j0 = Math.max(1, Math.round(40 / hz)), j1 = Math.round(4000 / hz);
    let flux = 0;
    for (let i = j0; i <= j1; i++) { const d = A.fbuf[i] - A.prev[i]; if (d > 0) flux += d; }
    A.prev.set(A.fbuf);
    flux /= (j1 - j0 + 1) * 255;
    feat.fluxAvg += (flux - feat.fluxAvg) * Math.min(1, dt * 1.5);
    const hit = Math.min(1, Math.max(0, flux / Math.max(feat.fluxAvg, 0.002) - 1.3) * 0.7);
    feat.hit = hit > feat.hit ? feat.hit + (hit - feat.hit) * Math.min(1, dt * 20) : feat.hit * Math.exp(-dt * 3.5);
    return feat;
  }
  let detailT = 0;

  // ================= 메인 루프 =================
  let prev = performance.now(), cardTick = 0, smoothSoft = 1, smoothRim = 0;
  function frame(now) {
    const dt = Math.min((now - prev) / 1000, 0.1); prev = now;
    simT += dt * 0.7;

    if (screen === 'landing') bgTarget = { sky: LANDING_SKY, low: LANDING_LOW, amt: 1 };
    if (screen === 'landing' || screen === 'library') {
      const k = Math.min(1, dt * 2.2);
      for (let i = 0; i < 3; i++) { bgNow.sky[i] += (bgTarget.sky[i] - bgNow.sky[i]) * k; bgNow.low[i] += (bgTarget.low[i] - bgNow.low[i]) * k; }
      bgNow.amt += (bgTarget.amt - bgNow.amt) * k;
      bgl.uniform3f(bgp.u('sky'), ...bgNow.sky); bgl.uniform3f(bgp.u('low'), ...bgNow.low);
      bgl.uniform1f(bgp.u('amt'), bgNow.amt);
      bgl.viewport(0, 0, bg.width, bg.height);
      bgl.uniform2f(bgp.u('r'), bg.width, bg.height);
      bgl.uniform1f(bgp.u('t'), now / 1000);
      bgl.drawArrays(bgl.TRIANGLE_STRIP, 0, 4);
    }

    if (screen === 'library') {
      layoutRing(dt);
      if (cardTick++ % 2 === 0) {
        PLACES.forEach((pl, i) => {
          if (!pl.pal) return;
          const targets = slots.filter(sl => sl.pl === pl && sl.vis);
          if (!targets.length) return;
          draw(168, 168, { t: simT + i * 3.1, spin: simT * 0.04 + i * 3.1, soft: 0.22, sharp: 0.5, rim: 0.4,
            motion: pl.motion, edge: 1, vivid: pl.vivid, amp: pl.amp, pal: pl.pal });
          targets.forEach(sl => blit(sl.ctx, 168, 168));
        });
      }
    }

    if ((screen === 'detail' || screen === 'record') && dialDirty) { DIALS.forEach(d => drawDial(d.ctx)); dialDirty = false; }
    if (screen === 'detail' && cur) {
      const e = (now - seqStart) / 1000;
      const S = sequence(e);
      smoothSoft += (S.soft - smoothSoft) * Math.min(1, dt * 4); smoothRim += (S.rim - smoothRim) * Math.min(1, dt * 4);
      S.soft = smoothSoft; S.rim = smoothRim;
      const F = readAudio(dt);
      // 멜로디 세기·맥박 → 흐름 속도·물결 크기·선명도, 멜로디 음높이 → 색이 위아래로 미끄러짐
      const M = musicMod(F, S.soft, S.rim);
      detailT += dt * 0.7 * F.tempo * M.speed;
      spin += dt * S.spinSpeed * F.tempo * (1 + 0.8 * F.mel);
      draw(320, 640, { t: detailT, spin, soft: M.soft, sharp, rim: M.rim, photo: S.photo, dissolve: S.dissolve, motion: cur.motion,
        vivid: cur.vivid, amp: cur.amp, energy: F.mel, pulse: F.hit, shift: F.shift, pal: cur.pal,
        tone: Math.pow(Math.min(1, Math.max(0, (0.85 - sharp) / 0.75)), 0.8) * Math.min(1, S.dissolve) });
      blit(pctx, 320, 640);
      $('phase').textContent = PHASES.find(p => e < p.until).label + (cur.audio && musicOn ? (muted ? '  ·  sound muted' : '  ·  ♪ playing') : '');
      if (cur.audio && musicArmed && !musicOn && e >= PHASES[1].until && cur.buffer) { musicArmed = false; startMusic(cur); }
      if (led.connected && now - lastSend > 33) { lastSend = now; sendFrame(); }
    }
    if (screen === 'record' && rec.img) {
      let S;
      if (rec.running) {
        const e = (now - rec.start) / 1000;
      S = sequence(e);
      const ready = !rec.done && e >= PHASES[3].until;
      if (ready) { rec.done = true; validate(); }
    } else {
      S = { photo: 1, dissolve: 0, soft: 1, rim: 0, spinSpeed: 0.05 };    // 변환 전: 사진 그대로
    }
    // AI 팔레트가 오면 몇 초에 걸쳐 그 색으로 옮겨감
    if (rec.palTarget) {
      const k = Math.min(1, dt * 1.2); let left = 0;
      rec.pal = rec.pal.map((c, i) => c.map((v, j) => { const n = v + (rec.palTarget[i][j] - v) * k; left += Math.abs(rec.palTarget[i][j] - n); return n; }));
      if (left < 0.004) { rec.pal = rec.palTarget; rec.palTarget = null; }
    }
    const F = readAudio(dt);
    rec.soft += (S.soft - rec.soft) * Math.min(1, dt * 4); rec.rim += (S.rim - rec.rim) * Math.min(1, dt * 4);
    const M = musicMod(F, rec.soft, rec.rim);
    rec.t += dt * 0.7 * F.tempo * M.speed; rec.spin += dt * S.spinSpeed * F.tempo * (1 + 0.8 * F.mel);
    draw(320, 640, { t: rec.t, spin: rec.spin, soft: M.soft, sharp, rim: M.rim,
      photo: S.photo, dissolve: S.dissolve, motion: rec.motion, vivid: rec.vivid, energy: F.mel, pulse: F.hit, shift: F.shift, pal: rec.pal,
      tone: Math.pow(Math.min(1, Math.max(0, (0.85 - sharp) / 0.75)), 0.8) * Math.min(1, S.dissolve) });
      blit(rctx, 320, 640);
      if (led.connected && now - lastSend > 33) { lastSend = now; sendFrame(); }
    }
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(rafId);
    clearTimeout(analyzeTimer);
    life.abort();
    led.destroy();
    if (src) { try { src.stop(); } catch (e) {} }
    if (actx) actx.close();
    ring.innerHTML = '';
  };
}
