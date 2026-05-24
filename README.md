# YouTube Roulette Game

Kid-friendly web game that picks one YouTube video from saved YouTube links with a roulette-style animation and then plays it automatically.

## How to use

1. Run `node server.js`.
2. Open `http://localhost:4173`.
3. Paste YouTube video URLs, one per line.
4. Click `불러오기`.
5. Click `돌리기`.
6. The selected video will start playing in the embedded player.

## Notes

- The game attempts autoplay with sound after the roulette stops, but some browsers may still limit autoplay behavior.
- Opening the page with `file://` can trigger YouTube error 153 because the embed needs an HTTP referrer.

## Share

After GitHub Pages is enabled for this repository, the site should be available at:

`https://srb-it.github.io/jw_play/`
