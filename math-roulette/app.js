const urlsTextarea = document.getElementById("video-urls");
const loadButton = document.getElementById("load-button");
const spinButton = document.getElementById("spin-button");
const pickButton = document.getElementById("pick-button");
const saveButton = document.getElementById("save-button");
const statusText = document.getElementById("status");
const playbackStatus = document.getElementById("playback-status");
const serverNote = document.getElementById("server-note");
const rouletteStrip = document.getElementById("roulette-strip");
const playerFrame = document.getElementById("player-frame");
const videoPicker = document.getElementById("video-picker");
const pickerClose = document.getElementById("picker-close");
const videoOptions = document.getElementById("video-options");
const quiz = document.getElementById("math-quiz");
const quizClose = document.getElementById("quiz-close");
const quizProgress = document.getElementById("quiz-progress");
const quizEquation = document.getElementById("quiz-equation");
const quizAnswers = document.getElementById("quiz-answers");
const quizFeedback = document.getElementById("quiz-feedback");
const quizMark = document.getElementById("quiz-mark");

let videos = [];
let spinning = false;
let audioContext = null;
let audioGainNode = null;
let winnerVideoId = null;
let spinSoundTimers = [];
let correctStreak = 0;
let quizVideo = null;
let recentQuestions = [];
let expectedAnswer = 0;
let quizFeedbackTimer = null;
const ROULETTE_STREAK = 3;
const PICKED_VIDEO_STREAK = 5;
const MAX_ADDEND = 5;
const QUIZ_FEEDBACK_DURATION = 1000;
const QUIZ_MALLET_GAIN = 2.7;
const SPIN_TICK_GAIN = 9;
const ADDITION_QUESTIONS = Array.from({ length: MAX_ADDEND }, (_, index) =>
  Array.from({ length: index + 1 }, (_, other) => [index + 1, other + 1])
).flat();
const LOCAL_URL = "http://localhost:4174";
const PLACEHOLDER_VIDEO_IDS = ["M7lc1UVf-VE", "dQw4w9WgXcQ", "ysz5S6PUM-U", "aqz-KE-bpKQ", "ScMzIvxBSi4"];
const SAVED_URLS_KEY = "youtube-roulette-saved-urls";
const DEFAULT_URLS = [
  "https://youtu.be/TqZgk2AQhk8?si=tixolOy-5ZuCiZ1N",
  "https://youtu.be/CS5Ko_Ty4P8?si=5B_mN1Y6awdVWNeC",
  "https://youtu.be/43BVARn7r0o?si=F4ngldZu9Mi-hTIb",
  "https://youtu.be/fpfWIWB5904?si=EfJUZtDxo9Fl3UVS",
  "https://youtu.be/syBo0IjgJlM?si=QPwsWHj1zJ_Lt7Sb",
  "https://youtu.be/HUMYQ-4sc6g?si=pL1SJCV6V8X7lZo-",
  "https://youtu.be/Nn_d3vdwpJ8?si=9klwSwIezdhOuF7B",
].join("\n");

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
    urlsTextarea.value = DEFAULT_URLS;
    updateStatus("기본 티니핑 링크를 채워뒀어요. 링크 불러오기를 눌러 주세요.");
    return;
  }

  urlsTextarea.value = savedUrls;
  updateStatus("저장된 링크를 불러왔어요. 링크 불러오기를 누르거나 바로 수정해도 됩니다.");
}

function redirectToLocalServer() {
  if (window.location.protocol !== "file:") {
    return;
  }

  updateStatus("로컬 서버로 이동 중이에요...");
  window.location.replace(LOCAL_URL);
}

function updateServerNote() {
  if (window.location.protocol === "file:") {
    serverNote.hidden = false;
    serverNote.textContent = `유튜브 재생 오류 153을 피하려면 file:// 대신 ${LOCAL_URL}으로 열어 주세요.`;
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
  const start = audioContext.currentTime;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(160, frequency * 0.78), start + duration);

  gainNode.gain.setValueAtTime(0.001, start);
  gainNode.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioGainNode);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
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
    const volume = (0.12 + (1 - progress) * 0.08) * SPIN_TICK_GAIN;
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
    pickButton.disabled = true;
    return;
  }

  if (parsed.length < 2) {
    updateStatus("유튜브 링크를 두 개 이상 붙여 넣어 주세요.");
    spinButton.disabled = true;
    pickButton.disabled = true;
    return;
  }

  videos = parsed;
  resetRoulettePosition(buildRouletteSequence());
  spinButton.disabled = false;
  pickButton.disabled = false;
  setWinner(null);
  playerFrame.src = "about:blank";
  playbackStatus.textContent = "";
  updateStatus(`${videos.length}개의 영상을 불러왔어요.`);
}

function openVideoPicker() {
  if (spinning || pickButton.disabled || videoPicker.open || quiz.open) {
    return;
  }

  videoOptions.replaceChildren();
  for (const video of videos) {
    const button = document.createElement("button");
    button.type = "button";
    const thumbnail = document.createElement("img");
    thumbnail.src = video.thumbnail;
    thumbnail.alt = "";
    const title = document.createElement("span");
    title.textContent = video.title;
    button.append(thumbnail, title);
    button.addEventListener("click", () => {
      videoPicker.close();
      openQuiz(video);
    });
    videoOptions.append(button);
  }
  videoPicker.showModal();
}

function spinRoulette() {
  if (spinning || videos.length < 2) {
    return;
  }

  spinning = true;
  spinButton.disabled = true;
  pickButton.disabled = true;
  loadButton.disabled = true;
  playbackStatus.textContent = "룰렛이 돌아가는 중...";
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
    playbackStatus.textContent = `${winner.title} 당첨!`;
    spinning = false;
    spinButton.disabled = false;
    pickButton.disabled = false;
    loadButton.disabled = false;
  }, 4600);
}

function requiredQuizStreak() {
  return quizVideo ? PICKED_VIDEO_STREAK : ROULETTE_STREAK;
}

function updateQuizProgress() {
  const target = quizVideo ? `${quizVideo.title} · ` : "";
  quizProgress.textContent = `${target}연속 정답 ${correctStreak} / ${requiredQuizStreak()}`;
}

function clearQuizResult() {
  window.clearTimeout(quizFeedbackTimer);
  quizFeedbackTimer = null;
  quizMark.hidden = true;
  quizAnswers.disabled = false;
}

function playMalletStrike(start, partials) {
  for (const [frequency, volume, duration] of partials) {
    const tone = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    tone.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(volume * QUIZ_MALLET_GAIN, start + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
    tone.connect(envelope);
    envelope.connect(audioContext.destination);
    tone.onended = () => envelope.disconnect();
    tone.start(start);
    tone.stop(start + duration);
  }
}

function playQuizResultSound(correct) {
  if (!window.AudioContext) {
    return;
  }

  ensureAudioContext();
  const start = audioContext.currentTime;
  if (correct) {
    playMalletStrike(start, [[784, 0.21, 0.25], [2352, 0.07, 0.1], [4916, 0.025, 0.05]]);
    playMalletStrike(start + 0.18, [[659, 0.21, 0.25], [1977, 0.07, 0.1], [4132, 0.025, 0.05]]);
    playMalletStrike(start + 0.36, [[523, 0.21, 0.42], [1569, 0.07, 0.14], [3279, 0.025, 0.07]]);
  } else {
    playMalletStrike(start, [[932, 0.19, 0.18], [2796, 0.095, 0.075], [4680, 0.035, 0.035]]);
  }
}

function showNextQuestion() {
  const choices = ADDITION_QUESTIONS.filter((question) => !recentQuestions.includes(question));
  const question = choices[Math.floor(Math.random() * choices.length)];
  recentQuestions = [...recentQuestions, question].slice(1 - requiredQuizStreak());
  const [left, right] = Math.random() < 0.5 ? question : [...question].reverse();
  expectedAnswer = left + right;
  quizEquation.textContent = `${left} + ${right} = ?`;
}

function openQuiz(video = null) {
  if (spinning || quiz.open || (video ? pickButton.disabled : spinButton.disabled)) {
    return;
  }

  correctStreak = 0;
  quizVideo = video;
  recentQuestions = [];
  clearQuizResult();
  quizFeedback.textContent = "";
  updateQuizProgress();
  showNextQuestion();
  quiz.showModal();
}

function checkQuizAnswer(button) {
  if (!quiz.open || quizFeedbackTimer !== null) {
    return;
  }

  const correct = Number(button.value) === expectedAnswer;
  correctStreak = correct ? correctStreak + 1 : 0;
  updateQuizProgress();
  quizFeedback.textContent = correct
    ? "정답이에요!"
    : "연속 정답은 0개부터 다시 시작해요. 이 문제를 한 번 더 풀어 봐요!";
  quizMark.textContent = correct ? "\u25cb" : "\u00d7";
  quizMark.classList.toggle("is-incorrect", !correct);
  quizMark.hidden = false;
  quizAnswers.disabled = true;

  quizFeedbackTimer = window.setTimeout(() => {
    clearQuizResult();
    if (!quiz.open) {
      return;
    }
    if (correctStreak === requiredQuizStreak()) {
      quiz.close();
      if (quizVideo) {
        setWinner(quizVideo);
        playSelectedVideo(quizVideo.id, false);
        playbackStatus.textContent = `${quizVideo.title} 재생!`;
      } else {
        spinRoulette();
      }
    } else if (correct) {
      showNextQuestion();
      quizAnswers.firstElementChild.focus();
    } else {
      button.focus();
    }
  }, QUIZ_FEEDBACK_DURATION);
  playQuizResultSound(correct);
}

loadButton.addEventListener("click", loadVideos);
spinButton.addEventListener("click", () => openQuiz());
pickButton.addEventListener("click", openVideoPicker);
pickerClose.addEventListener("click", () => videoPicker.close());
for (const button of quizAnswers.querySelectorAll("button")) {
  button.addEventListener("click", () => checkQuizAnswer(button));
}
quizClose.addEventListener("click", () => quiz.close());
quiz.addEventListener("close", () => {
  if (!quiz.open && quizFeedbackTimer !== null) {
    clearQuizResult();
  }
});
saveButton.addEventListener("click", saveUrlsToStorage);
updateServerNote();
redirectToLocalServer();
setWinner(null);
resetRoulettePosition(buildPlaceholderVideos());
restoreSavedUrls();
