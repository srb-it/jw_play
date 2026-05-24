# YouTube Roulette Game

Kid-friendly web game that picks one YouTube video from five choices with a roulette-style animation and then plays it automatically.

## How to use

1. Run `node server.js`.
2. Open `http://localhost:4173`.
3. Paste five YouTube video URLs.
4. Click `불러오기`.
5. Click `돌리기`.
6. The selected video will start playing in the embedded player.

## Notes

- The game starts playback muted because browsers often block unmuted autoplay.
- Click `소리 켜기` after the winner is selected if you want sound.
- Opening the page with `file://` can trigger YouTube error 153 because the embed needs an HTTP referrer.
