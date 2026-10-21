// ================= 공간 데이터 =================
// 사진·음악은 public/assets 아래 파일 (yarn extract-assets 로 원본 HTML에서 분리)
const PHOTO = '/assets/photos/';
const SOUND = '/assets/sounds/';

// 실행 중에 img, pal, buffer 등이 붙으므로 매번 새 배열을 만들어 씀
export function createPlaces() {
  return [
    { id: 'road', motion: 0, name: 'West Coast Expressway', date: '2025.08.23', photo: PHOTO + 'road.jpg', audio: SOUND + 'city.mp3', sat: 1.45, vivid: 1.12,
      memory: 'Driving south at dusk, red light spilling past the window. We said nothing for miles.' },
    { id: 'sevensisters', motion: 6, name: 'Seven Sisters', date: '2024.11.17', photo: PHOTO + 'sheep.jpg', audio: SOUND + 'seven-sisters.mp3',
      memory: 'Wind over the cliffs and a lone sheep in the grass. The sea was so blue it felt unreal.' },
    { id: 'anmok', motion: 5, name: 'Anmok Beach, Gangneung', date: '2024.06.02', photo: PHOTO + 'anmok.jpg', audio: SOUND + 'beach.mp3',
      memory: 'At dawn the sun rose straight out of the sea. My coffee went cold as I counted waves.' },
    // 사진 대부분이 파랑이라 자동 추출하면 단색이 됨 → 사진 속 톤을 직접 골라 씀 (위 → 아래)
    // 하늘 · 남산 능선의 남색 · 강물 파랑(가장 넓게 보임) · 물에 비친 금빛 불빛 · 밤 강물
    { id: 'ttuk', motion: 1, name: 'Ttukseom, Han River', date: '2025.10.10', photo: PHOTO + 'ttukseom.jpg', audio: SOUND + 'river.wav',
      palette: ['#86bdf2', '#2f5fb0', '#3f86d6', '#ffcf6a', '#1a3c7a'], vivid: 1.2, amp: 1.8,
      memory: 'On the way home, city lights trembled on the water. The wind slowly washed the day away.' },
    { id: 'gwangan', disabled: true, motion: 4, name: 'Gwangalli Beach, Busan', date: '2023.07.29', scene: 'bridgeNight',
      memory: 'Beers on the beach steps with a friend. Each time the bridge lights changed, we laughed.' },
    { id: 'jeonju', disabled: true, motion: 3, name: 'Jeonju Hanok Village', date: '2025.04.05', scene: 'hanokDusk',
      memory: 'Sunset settling on tiled roofs. The chimes under the eaves kept slowing my steps.' },
  ];
}
