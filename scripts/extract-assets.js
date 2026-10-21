// 원본 nemo_window.html 안의 base64 사진·음악을 public/assets 아래 파일로 꺼냄
// 사용: yarn extract-assets <nemo_window.html 경로>
const fs = require('fs');
const path = require('path');

const src = process.argv[2];
if (!src) {
  console.error('사용법: yarn extract-assets <nemo_window.html 경로>');
  process.exit(1);
}

const OUT = path.join(__dirname, '..', 'public', 'assets');
const NAMES = {
  PHOTO_ROAD: 'photos/road.jpg',
  PHOTO_SHEEP: 'photos/sheep.jpg',
  PHOTO_ANMOK: 'photos/anmok.jpg',
  PHOTO_TTUK: 'photos/ttukseom.jpg',
  SOUND_CITY: 'sounds/city.mp3',
  SOUND_BEACH: 'sounds/beach.mp3',
  SOUND_SEVEN: 'sounds/seven-sisters.mp3',
};

const html = fs.readFileSync(src, 'utf8');
const re = /const (\w+) = "data:[\w/+.-]+;base64,([A-Za-z0-9+/=]+)"/g;
let m, count = 0;
while ((m = re.exec(html))) {
  const rel = NAMES[m[1]];
  if (!rel) { console.warn('알 수 없는 상수, 건너뜀:', m[1]); continue; }
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const buf = Buffer.from(m[2], 'base64');
  fs.writeFileSync(file, buf);
  console.log(`${m[1]} → public/assets/${rel} (${(buf.length / 1024).toFixed(0)} KB)`);
  count++;
}
console.log(`완료: ${count}개 파일`);
