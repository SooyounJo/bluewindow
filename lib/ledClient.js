// 라즈베리 파이 LED 서버(pi/led_server.py)와의 연결 규칙
// - 접속: ws://<파이 주소>:8765
// - 프레임: 64×32 RGB 바이트 (64*32*3 = 6144바이트) 바이너리
// - 명령: JSON 텍스트 {"brightness": 1~100}, {"clear": true}
// 이 규칙은 파이 쪽 코드와 반드시 함께 바꿔야 함
export const LED_PORT = 8765;
export const PANEL_W = 64;
export const PANEL_H = 32;
export const FRAME_BYTES = PANEL_W * PANEL_H * 3;
const MAX_BUFFERED = 64 * 1024;

export function createLedClient({ onOpen, onClose } = {}) {
  let ws = null;

  return {
    get active() { return ws !== null; },
    get connected() { return ws !== null && ws.readyState === WebSocket.OPEN; },

    connect(host) {
      const url = `ws://${host}:${LED_PORT}`;
      const sock = new WebSocket(url);
      sock.binaryType = 'arraybuffer';
      sock.onopen = () => onOpen?.(url);
      sock.onclose = () => { if (ws === sock) ws = null; onClose?.(url); };
      ws = sock;
      return url;
    },
    disconnect() { ws?.close(); },

    setBrightness(value) {
      if (this.connected) ws.send(JSON.stringify({ brightness: Math.round(value) }));
    },
    clear() {
      if (this.connected) ws.send(JSON.stringify({ clear: true }));
    },
    sendFrame(bytes) {
      if (!this.connected || bytes.length !== FRAME_BYTES) return;
      if (ws.bufferedAmount < MAX_BUFFERED) ws.send(bytes);
    },

    // 화면을 떠날 때: UI 콜백 없이 조용히 닫기
    destroy() {
      if (!ws) return;
      ws.onclose = null;
      ws.close();
      ws = null;
    },
  };
}
