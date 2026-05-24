const urlsTextarea = document.getElementById("video-urls");
const loadButton = document.getElementById("load-button");
const spinButton = document.getElementById("spin-button");
const saveButton = document.getElementById("save-button");
const statusText = document.getElementById("status");
const serverNote = document.getElementById("server-note");
const rouletteStrip = document.getElementById("roulette-strip");
const playerFrame = document.getElementById("player-frame");

let videos = [];
let spinning = false;
let audioContext = null;
let audioGainNode = null;
let winnerVideoId = null;
let spinSoundTimers = [];
const PLACEHOLDER_VIDEO_IDS = ["M7lc1UVf-VE", "dQw4w9WgXcQ", "ysz5S6PUM-U", "aqz-KE-bpKQ", "ScMzIvxBSi4"];
const SAVED_URLS_KEY = "youtube-roulette-saved-urls";

function extractVideoId(rawUrl) {
  if (!rawUrl) {
    return null;
  }

  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return url.pathname.slice(1) || null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v");
      }

      if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
        return url.pathname.split("/")[2] || null;
      }
    }
  } catch (error) {
    return null;
  }

  return null;
}

function sanitizeVideoId(videoId) {
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : null;
}

function buildVideoModel(videoId, index) {
  return {
    id: videoId,
    title: `영상 ${index + 1}`,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

function buildPlaceholderVideos() {
  return PLACEHOLDER_VIDEO_IDS.map((videoId, index) => buildVideoModel(videoId, index));
}

function parseRawUrls(rawText) {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function updateStatus(message) {
  statusText.textContent = message;
}

function saveUrlsToStorage() {
  const rawText = urlsTextarea.value.trim();

  if (!rawText) {
    updateStatus("저장할 링크가 없어요. 먼저 유튜브 링크를 붙여 넣어 주세요.");
    return;
  }

  window.localStorage.setItem(SAVED_URLS_KEY, rawText);
  updateStatus("링크를 저장했어요. 다음에 다시 열어도 자동으로 불러옵니다.");
}

function restoreSavedUrls() {
  const savedUrls = window.localStorage.getItem(SAVED_URLS_KEY);

  if (!savedUrls) {
    return;
  }

  urlsTextarea.value = savedUrls;
  updateStatus("저장된 링크를 불러왔어요. 불러오기를 누르거나 바로 수정해도 됩니다.");
}

function redirectToLocalServer() {
  if (window.location.protocol !== "file:") {
    return;
  }

  const localUrl = "http://localhost:4173";
  updateStatus("로컬 서버로 이동 중이에요...");
  window.location.replace(localUrl);
}

function updateServerNote() {
  if (window.location.protocol === "file:") {
    serverNote.hidden = false;
    serverNote.textContent = "유튜브 재생 오류 153을 피하려면 file:// 대신 http://localhost:4173 으로 열어 주세요.";
    return;
  }

  serverNote.hidden = true;
  serverNote.textContent = "";
}

function setWinner(video) {
  if (!video) {
    winnerVideoId = null;
    return;
  }

  winnerVideoId = video.id;
}

function renderStrip(items) {
  rouletteStrip.innerHTML = "";

  items.forEach((video) => {
    const card = document.createElement("article");
    card.className = "roulette-item";

    const image = document.createElement("img");
    image.src = video.thumbnail;
    image.alt = video.title;

    const label = document.createElement("p");
    label.textContent = video.title;

    card.append(image, label);
    rouletteStrip.append(card);
  });
}

function resetRoulettePosition(items) {
  rouletteStrip.style.transition = "none";
  rouletteStrip.style.transform = "translateX(0)";
  renderStrip(items);
  void rouletteStrip.offsetWidth;
}

function buildRouletteSequence() {
  const repeated = [];

  for (let round = 0; round < 7; round += 1) {
    videos.forEach((video, index) => {
      repeated.push({
        ...video,
        title: `영상 ${index + 1}`,
      });
    });
  }

  return repeated;
}

function getPlayerUrl(videoId, muted) {
  const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
  embedUrl.searchParams.set("autoplay", "1");
  embedUrl.searchParams.set("mute", muted ? "1" : "0");
  embedUrl.searchParams.set("playsinline", "1");
  embedUrl.searchParams.set("rel", "0");
  embedUrl.searchParams.set("enablejsapi", "1");
  embedUrl.searchParams.set("origin", window.location.origin);
  return embedUrl.toString();
}

function playSelectedVideo(videoId, muted = true) {
  playerFrame.src = getPlayerUrl(videoId, muted);
}

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new window.AudioContext();
    audioGainNode = audioContext.createGain();
    audioGainNode.gain.value = 0.16;
    audioGainNode.connect(audioContext.destination);
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function stopSpinMusic() {
  spinSoundTimers.forEach((timerId) => {
    try {
      window.clearTimeout(timerId);
    } catch (error) {
      return;
    }
  });
  spinSoundTimers = [];
}

function playTickSound(frequency, duration, type = "square", volume = 0.22) {
  ensureAudioContext();

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(160, frequency * 0.78), now + duration);

  gainNode.gain.setValueAtTime(0.001, now);
  gainNode.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioGainNode);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function playWinnerChime() {
  playTickSound(880, 0.16, "triangle", 0.18);
  spinSoundTimers.push(
    window.setTimeout(() => playTickSound(1174, 0.2, "triangle", 0.16), 90)
  );
}

function startSpinMusic() {
  ensureAudioContext();
  stopSpinMusic();

  const totalDuration = 4300;
  let elapsed = 0;
  let step = 0;

  while (elapsed < totalDuration) {
    const progress = elapsed / totalDuration;
    const interval = 70 + progress * 170;
    const frequency = 720 - progress * 260 + (step % 3) * 34;
    const volume = 0.12 + (1 - progress) * 0.08;
    const type = step % 2 === 0 ? "square" : "triangle";

    spinSoundTimers.push(
      window.setTimeout(() => {
        playTickSound(frequency, 0.075, type, volume);
      }, elapsed)
    );

    elapsed += interval;
    step += 1;
  }
}

function loadVideos() {
  const rawUrls = parseRawUrls(urlsTextarea.value);
  const parsed = rawUrls.map((rawUrl, index) => {
    const extracted = extractVideoId(rawUrl);
    const videoId = extracted ? sanitizeVideoId(extracted) : null;
    return videoId ? buildVideoModel(videoId, index) : null;
  });

  if (parsed.some((item) => !item)) {
    updateStatus("잘못된 링크가 있어요. 유튜브 URL만 한 줄에 하나씩 넣어 주세요.");
    spinButton.disabled = true;
    return;
  }

  if (parsed.length < 2) {
    updateStatus("유튜브 링크를 두 개 이상 붙여 넣어 주세요.");
    spinButton.disabled = true;
    return;
  }

  videos = parsed;
  resetRoulettePosition(buildRouletteSequence());
  spinButton.disabled = false;
  setWinner(null);
  playerFrame.src = "about:blank";
  updateStatus(`${videos.length}개의 영상을 불러왔어요. 돌리기 버튼을 눌러 주세요.`);
}

function spinRoulette() {
  if (spinning || videos.length < 2) {
    return;
  }

  spinning = true;
  spinButton.disabled = true;
  loadButton.disabled = true;
  updateStatus("룰렛이 돌아가는 중...");
  startSpinMusic();

  const winnerIndex = Math.floor(Math.random() * videos.length);
  const sequence = buildRouletteSequence();
  resetRoulettePosition(sequence);

  const itemWidth = 168 + 12;
  const targetIndex = videos.length * 5 + winnerIndex;
  const shellWidth = rouletteStrip.parentElement.clientWidth;
  const offset = targetIndex * itemWidth - shellWidth / 2 + itemWidth / 2;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      rouletteStrip.style.transition = "transform 4.5s cubic-bezier(0.14, 0.82, 0.18, 1)";
      rouletteStrip.style.transform = `translateX(-${offset}px)`;
    });
  });

  window.setTimeout(() => {
    const winner = videos[winnerIndex];
    stopSpinMusic();
    playWinnerChime();
    setWinner(winner);
    playSelectedVideo(winner.id, false);
    updateStatus(`${winner.title} 당첨! 아래에서 바로 재생합니다.`);
    spinning = false;
    spinButton.disabled = false;
    loadButton.disabled = false;
  }, 4600);
}

loadButton.addEventListener("click", loadVideos);
spinButton.addEventListener("click", spinRoulette);
saveButton.addEventListener("click", saveUrlsToStorage);
updateServerNote();
redirectToLocalServer();
setWinner(null);
resetRoulettePosition(buildPlaceholderVideos());
restoreSavedUrls();
