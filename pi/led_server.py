#!/usr/bin/env python3
# 라즈베리 파이용: 웹소켓으로 받은 64x32 RGB 프레임을 LED 패널에 표시
# 실행: sudo ~/ledenv/bin/python led_server.py

import asyncio
import json

import websockets
from PIL import Image
from rgbmatrix import RGBMatrix, RGBMatrixOptions

W, H = 64, 32
FRAME_BYTES = W * H * 3
PORT = 8765

opts = RGBMatrixOptions()
opts.rows = H
opts.cols = W
opts.gpio_slowdown = 2
opts.hardware_mapping = "regular"
opts.drop_privileges = False

matrix = RGBMatrix(options=opts)
canvas = matrix.CreateFrameCanvas()


async def handler(ws):
    global canvas
    print("연결됨:", ws.remote_address)
    try:
        async for msg in ws:
            if isinstance(msg, (bytes, bytearray)):
                if len(msg) != FRAME_BYTES:
                    continue
                img = Image.frombytes("RGB", (W, H), bytes(msg))
                canvas.SetImage(img)
                canvas = matrix.SwapOnVSync(canvas)
            else:
                cmd = json.loads(msg)
                if "brightness" in cmd:
                    matrix.brightness = max(1, min(100, int(cmd["brightness"])))
                if cmd.get("clear"):
                    canvas.Clear()
                    canvas = matrix.SwapOnVSync(canvas)
    except websockets.ConnectionClosed:
        pass
    finally:
        print("연결 끊김")
        canvas.Clear()
        canvas = matrix.SwapOnVSync(canvas)


async def main():
    async with websockets.serve(handler, "0.0.0.0", PORT,
                                max_size=2**20, compression=None):
        print(f"LED 서버 대기 중 (포트 {PORT}). 종료: Ctrl+C")
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        matrix.Clear()
