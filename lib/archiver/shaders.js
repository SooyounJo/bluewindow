// ================= 공용 WebGL 셰이더 =================
export const FS = `
precision mediump float;
uniform vec2 r;
uniform float t, spin;
uniform float soft;      // 1 = 디테일 없이 테두리로 모임, 0 = 일렁이는 물결
uniform float sharp;     // 다이얼: 뚜렷함
uniform float rimAmt;    // 테두리 빛의 세기
uniform float photoMix;  // 1 = 사진 그대로
uniform float dissolve;  // 사진이 풀어지는 정도
uniform vec3 c0, c1, c2, c3, c4;
uniform sampler2D photo;
uniform vec4 pr;         // 사진 맞춤 (offset.xy, scale.zw)
uniform float motion;    // 움직임 종류 0~6
uniform float edgeGlow;  // 박스 테두리를 밝게 (라이브러리 카드용)
uniform float vivid;     // 채도 배율 (공간별)
uniform float energy;    // 음악 세기 0~1
uniform float pulse;     // 소리가 솟는 순간의 짧은 맥박 0~1 (빠르게 오르고 천천히 빠짐)
uniform float shift;     // 멜로디 음높이에 따라 색이 위아래로 미끄러짐
uniform float tone;      // 1에 가까울수록 두 가지 색(투톤)으로 단순해짐
uniform vec3 tA, tB;     // 투톤 색 (위, 아래)
uniform float amp;       // 움직임 세기 배율 (공간별, 1 = 기본)

vec3 pal5(float x) {
  x = clamp(x, 0.0, 1.0) * 4.0;
  float i = floor(min(x, 3.999));
  float f = x - i;
  f = mix(f, smoothstep(0.0, 1.0, smoothstep(0.0, 1.0, f)), sharp);
  vec3 a = i < 0.5 ? c0 : i < 1.5 ? c1 : i < 2.5 ? c2 : c3;
  vec3 b = i < 0.5 ? c1 : i < 1.5 ? c2 : i < 2.5 ? c3 : c4;
  return mix(a, b, f);
}
vec3 pal(float x) {
  vec3 full = pal5(x);
  if (tone < 0.001) return full;
  vec3 two = mix(tA, tB, smoothstep(0.25, 0.75, clamp(x, 0.0, 1.0)));
  return mix(full, two, tone);
}
float tri(float x) { return abs(fract(x) * 2.0 - 1.0); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 1.7; a *= 0.5; }
  return s;
}
float fine;   // 무늬 촘촘함 배율 (1 = 기본, 또렷할수록 커짐). main 에서 정함
// 움직임별 팔레트 좌표 (y = 위에서 아래 0~1)
float pattern(vec2 uv, vec2 asp, float y, float v) {
  vec2 p = (uv - 0.5) * asp;
  if (motion < 0.5) {                       // 0 물결
    return y + 0.17 * v;
  } else if (motion < 1.5) {                // 1 숨결: 가운데서 퍼지는 동심원
    float d = length(p * vec2(1.0, 1.15));
    float ring = 0.5 + 0.5 * sin(d * 9.0 * fine - t * 1.8);
    return y * 0.55 + 0.28 + (ring - 0.5) * 0.42 * smoothstep(0.75, 0.0, d);
  } else if (motion < 2.5) {                // 2 안개: 흘러가는 연기
    vec2 q = uv * asp * 2.2 * fine;
    float w = fbm(q + vec2(t * 0.18, -t * 0.12));
    float f = fbm(q * 1.3 + 2.4 * w + vec2(-t * 0.08, t * 0.05));
    return y + (f - 0.5) * 0.85;
  } else if (motion < 3.5) {                // 3 오로라: 옆으로 흔들리는 띠
    float sway = sin(uv.x * 3.2 * fine + t * 0.9 + sin(uv.y * 5.0 * fine - t * 0.7) * 1.6);
    float streak = sin(uv.y * 26.0 * fine + sin(uv.x * 2.0 + t) * 3.0) * 0.03;
    return y + 0.2 * sway * (0.6 + 0.4 * sin(t * 0.4 + uv.y * 3.0)) + streak;
  } else if (motion < 4.5) {                // 4 빛 방울: 떠다니며 합쳐지는 덩어리 (촘촘할수록 작아짐)
    float f = 0.0, sz = 0.018 / (fine * fine);
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      vec2 c = vec2(sin(t * (0.31 + fi * 0.07) + fi * 1.9), cos(t * (0.27 + fi * 0.05) + fi * 2.7)) * asp * 0.34;
      f += sz / (dot(p - c, p - c) + 0.004 / (fine * fine));
    }
    return mix(y, 0.3, smoothstep(0.25, 2.4, f) * 0.9);
  } else if (motion > 5.5) {                // 6 숲빛: 나무 사이로 기울어 내리는 빛줄기와 잎 그림자
    float s = uv.x + uv.y * 0.42;
    float sweep = sin(t * 0.22) * 0.6;
    float beam = pow(0.5 + 0.5 * sin(s * 6.5 * fine + sweep + t * 0.15), 3.0);
    beam *= 0.55 + 0.45 * noise(vec2(s * 6.0 * fine, t * 0.5));
    beam *= smoothstep(0.0, 0.55, uv.y + 0.15);
    float leaf = noise(uv * asp * 7.0 * fine + vec2(sin(t * 0.6) * 0.6, t * 0.18)) - 0.5;
    return mix(y, 0.0, beam * 0.95) + leaf * 0.16;
  } else {                                  // 5 밀물: 오르내리는 층과 반짝임
    float tide = sin(t * 0.45) * 0.12;
    float swell = sin(uv.x * 5.0 * fine + t * 1.3) * 0.05 + sin(uv.x * 11.0 * fine - t * 2.1) * 0.025;
    float glint = (noise(vec2(uv.x * 5.0 * fine + t * 0.6, uv.y * 70.0)) - 0.5) * 0.1 * smoothstep(0.35, 0.85, y);
    return y + tide + swell * (0.4 + y) + glint;
  }
}
float roundBox(vec2 p, vec2 b, float rad) {
  vec2 q = abs(p) - b + rad;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
}
vec3 photoAt(vec2 uv) {
  vec2 p = pr.xy + vec2(uv.x, 1.0 - uv.y) * pr.zw;
  return texture2D(photo, clamp(p, 0.001, 0.999)).rgb;
}

void main() {
  vec2 uv = gl_FragCoord.xy / r;
  float aspect = r.x / r.y;
  vec2 asp = vec2(max(aspect, 1.0), max(1.0 / aspect, 1.0));
  // 또렷할수록 무늬가 잘게 쪼개짐
  float crisp = smoothstep(0.35, 1.0, sharp);
  fine = 1.0 + 1.2 * crisp;
  vec2 q = uv * asp * 2.4 * fine;

  // 일렁이는 물결
  float v = sin(q.x + t) + sin(q.y * 1.3 - t * 0.8)
          + sin((q.x + q.y) * 0.7 + t * 1.2)
          + sin(length(q - vec2(asp.x * 1.2 + sin(t * 0.5), asp.y * 1.2 + cos(t * 0.4) * 1.4)) * 2.0 - t * 1.5);
  v *= 1.0 + 0.8 * energy + 0.6 * pulse;            // 소리가 차오를수록 물결이 크게
  float y = 1.0 - uv.y + shift;
  vec3 detail = pal(y + (pattern(uv, asp, y, v) - y) * amp * (1.0 + 0.6 * energy + 0.5 * pulse));
  vec3 calm = pal(y + 0.05 * sin(t * 0.35 + uv.x * 2.0));

  // 창 모양 (둥근 사각형) — ed: 테두리에서 안쪽으로의 거리
  vec2 p = (uv - 0.5) * asp;
  float ed = -roundBox(p, asp * 0.5 - 0.015, 0.2);

  // 안쪽: 흐릴수록 디테일이 빠지고 매끈한 세로 그라디언트만 남음
  float calmAmt = smoothstep(0.0, 0.6, soft);
  vec3 grad = mix(detail, calm, calmAmt);
  // 또렷할수록 대비·채도를 올려 쨍하게
  grad = (grad - 0.5) * mix(1.0, 1.22, sharp) + 0.5;
  float l = dot(grad, vec3(0.299, 0.587, 0.114));
  grad = mix(vec3(l), grad, mix(1.2, 1.45, crisp) * vivid);

  // 외곽에 맺힌 빛: 방사형이 아니라 위→아래로 흘러내리는 색, 경계 없이 안개처럼 번짐
  vec3 flowC = pal(tri(y * 0.9 + spin));
  float mxg = max(max(grad.r, grad.g), grad.b);
  vec3 localBright = grad / max(mxg, 0.08);                  // 그 자리 색을 같은 색조로 밝게
  vec3 rimC = mix(flowC, localBright, 0.45);
  float rl = dot(rimC, vec3(0.299, 0.587, 0.114));
  rimC = clamp(mix(vec3(rl), rimC, 1.3 * vivid) * 1.12, 0.0, 1.0);
  float w = mix(0.05, 0.2, soft);
  float edgeN = clamp(ed / (w * 3.0), 0.0, 1.0);               // 0 = 가장자리, 1 = 안쪽
  float rimK = pow(1.0 - edgeN, 2.2) * rimAmt;                 // 부드럽게 사라지는 곡선
  grad = mix(grad, rimC, clamp(rimK * 0.75, 0.0, 1.0));

  // 사진이 일렁이며 풀어짐
  vec3 ph = vec3(0.0);
  if (photoMix > 0.001) {
    vec2 wv = vec2(sin(uv.y * 13.0 + t * 2.2) + sin(uv.y * 4.0 - t), cos(uv.x * 11.0 + t * 1.7)) * 0.022 * dissolve;
    vec2 su = uv + wv;
    float rad = 0.06 * dissolve;
    ph = photoAt(su) * 0.2;
    for (int k = 0; k < 8; k++) {
      float a = float(k) * 0.7854 + t * 0.3;
      ph += photoAt(su + vec2(cos(a), sin(a) * aspect) * rad) * 0.1;
    }
  }
  grad *= 1.0 + 0.1 * energy + 0.15 * pulse;      // 맥박마다 살짝 밝아짐
  vec3 col = mix(grad, ph, photoMix);

  // 테두리 밝게: 그 자리의 색을 같은 색조 그대로 밝혀서 가장자리에 번지게
  if (edgeGlow > 0.001) {
    float mx = max(max(col.r, col.g), col.b);
    vec3 hue = col / max(mx, 0.06);                 // 색조는 유지, 밝기만 최대로
    float lum = dot(hue, vec3(0.299, 0.587, 0.114));
    hue = mix(vec3(lum), hue, 1.15);                // 채도 살짝 올림
    vec3 light = clamp(hue * 1.02 + 0.06, 0.0, 1.0);
    float e = -roundBox((uv - 0.5) * asp, asp * 0.5, 0.22);
    float g = exp(-max(e, 0.0) / 0.075) * (0.85 + 0.15 * sin(t * 0.8 + uv.x * 3.0 + uv.y * 2.0));
    col = mix(col, light, clamp(g * edgeGlow, 0.0, 0.9));
    col += light * 0.12 * exp(-max(e, 0.0) / 0.02) * edgeGlow;
  }
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const VS = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

// 랜딩·라이브러리 배경
export const BG_FS = `
precision mediump float;
uniform vec2 r; uniform float t;
uniform vec3 sky, low;   // 위쪽 색, 아래쪽 색 (랜딩: #78B7E3 / 라이브러리: 호버한 블록 색)
uniform float amt;       // 0 = 검은 배경, 1 = 색이 다 올라온 상태
uniform float dots;      // 1 = 망점·디더링 켬 (화면용), 0 = 끔 (LED 패널용)
// 4x4 순서 디더링 임계값 (0~1)
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
void main() {
  vec2 uv = gl_FragCoord.xy / r;
  float x = uv.x, y = uv.y;
  float edge = 0.74 + 0.06 * sin(x * 2.6 + t * 0.22) + 0.025 * sin(x * 6.0 - t * 0.31) - 0.05 * x;
  float band = smoothstep(edge - 0.11, edge + 0.015, y);
  float rise = smoothstep(0.52, 0.0, y);
  vec3 dark = mix(vec3(0.0), low, pow(rise, 1.3));
  vec3 col = mix(dark, sky, band);
  col = mix(vec3(0.02, 0.024, 0.031), col, amt);
  // 도트 컨셉: 밝을수록 커지는 아주 약한 망점 + 단계가 살짝 보이는 순서 디더링
  vec2 f = fract(gl_FragCoord.xy / 5.0) - 0.5;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float rad = 0.2 + 0.24 * sqrt(lum);
  float dotm = 1.0 - smoothstep(rad - 0.07, rad + 0.07, length(f));
  col *= mix(1.0, mix(0.88, 1.04, dotm), dots);
  col = mix(col, floor(col * 18.0 + bayer4(gl_FragCoord.xy)) / 18.0, dots);
  gl_FragColor = vec4(col, 1.0);
}`;

export function mkProg(g, vs, fs) {
  const sh = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s);
    if (!g.getShaderParameter(s, g.COMPILE_STATUS)) console.error(g.getShaderInfoLog(s)); return s; };
  const p = g.createProgram(); g.attachShader(p, sh(g.VERTEX_SHADER, vs)); g.attachShader(p, sh(g.FRAGMENT_SHADER, fs));
  g.linkProgram(p); g.useProgram(p);
  g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer());
  g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
  const loc = g.getAttribLocation(p, 'a'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
  const u = {}; return { p, u: n => (u[n] ??= g.getUniformLocation(p, n)) };
}
