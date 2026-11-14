const urlsTextarea = document.getElementById("video-urls");
const registerButton = document.getElementById("register-button");
const spinButton = document.getElementById("spin-button");
const pickButton = document.getElementById("pick-button");
const saveButton = document.getElementById("save-button");
const registerDialog = document.getElementById("register-dialog");
const registeredVideos = document.getElementById("registered-videos");
const videoAddForm = document.getElementById("video-add-form");
const newVideoUrl = document.getElementById("new-video-url");
const registerStatus = document.getElementById("register-status");
const statusText = document.getElementById("status");
const playbackStatus = document.getElementById("playback-status");
const serverNote = document.getElementById("server-note");
const rouletteStrip = document.getElementById("roulette-strip");
let playerFrame = document.getElementById("player-frame");
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
let youtubeApiLoading = null;
let youtubePlayer = null;
const ROULETTE_STREAK = 5;
const PICKED_VIDEO_STREAK = 10;
const SUBJECT_KEY = "math-roulette-subject";
const subjectDialog = document.getElementById("subject-dialog");
const subjectForm = document.getElementById("subject-form");
const subjectFields = subjectForm.elements;
const operations = {
  addition: { title: "덧셈", sign: "+", answer: (a, b) => a + b },
  subtraction: { title: "뺄셈", sign: "\u2212", answer: (a, b) => a - b },
  multiplication: { title: "곱셈", sign: "\u00d7", answer: (a, b) => a * b },
  division: { title: "나눗셈", sign: "\u00f7", answer: (a, b) => a / b }
};
const defaultSubject = { operation: "addition", sumTen: true, addFive: true, subtractTen: false, subtractFive: true, timesTable: false, table: "2", multiplyTen: true, divideTen: true };
let subject = { ...defaultSubject };
try {
  const saved = JSON.parse(localStorage.getItem(SUBJECT_KEY));
  if (Object.hasOwn(operations, saved?.operation)) {
    subject.operation = saved.operation;
    if (/^[2-9]$/.test(saved.table)) subject.table = String(saved.table);
    for (const key of Object.keys(defaultSubject)) {
      if (typeof defaultSubject[key] === "boolean" && typeof saved[key] === "boolean") subject[key] = saved[key];
    }
  }
} catch {}
let quizQuestions = [];
const QUIZ_FEEDBACK_DURATION = 1000;
const QUIZ_MALLET_GAIN = 3;
const SPIN_TICK_GAIN = 15;
const LOCAL_URL = "http://localhost:4174";
const PLACEHOLDER_VIDEO_IDS = ["M7lc1UVf-VE", "dQw4w9WgXcQ", "ysz5S6PUM-U", "aqz-KE-bpKQ", "ScMzIvxBSi4"];
const SAVED_URLS_KEY = "youtube-roulette-saved-urls";
const DEFAULT_VIDEO_URLS = [
  "https://youtu.be/TqZgk2AQhk8",
  "https://youtu.be/CS5Ko_Ty4P8",
].join("\n");
const FAMILY_API = "https://happy-family-roulette-sync.cloudygerbil.chatgpt.site/api/lists";
const FAMILY_STORAGE_KEY = "math-roulette-family";
const FAMILY_CODE_PATTERN = /^(?:[a-f0-9]{32}|[a-z0-9]{4})$/i;
const familyJoin = document.getElementById("family-join");
const familyConnected = document.getElementById("family-connected");
const familyCodeInput = document.getElementById("family-code");
const familyActiveCode = document.getElementById("family-active-code");
const familyCreate = document.getElementById("family-create");
const familyConnect = document.getElementById("family-connect");
const familyDisconnect = document.getElementById("family-disconnect");
const familyCopy = document.getElementById("family-copy");
const familyStatus = document.getElementById("family-status");
let family = null;
let familyBusy = false;
let familyRefreshing = false;
let familyGeneration = 0;
let familyReloadPending = false;

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
  if (registerDialog.open) registerStatus.textContent = message;
}

function saveUrlsToStorage() {
  const rawText = urlsTextarea.value.trim();

  if (!rawText) {
    updateStatus("저장할 링크가 없어요. 먼저 유튜브 링크를 붙여 넣어 주세요.");
    return;
  }

  window.localStorage.setItem(SAVED_URLS_KEY, rawText);
  loadVideos(true);
  updateStatus("저장했어요. 룰렛에 바로 반영됐어요.");
}

function restoreSavedUrls() {
  const savedUrls = window.localStorage.getItem(SAVED_URLS_KEY);

  if (!savedUrls) {
    urlsTextarea.value = DEFAULT_VIDEO_URLS;
    return;
  }

  urlsTextarea.value = savedUrls;
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

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!youtubeApiLoading) {
    youtubeApiLoading = new Promise((resolve, reject) => {
      window.onYouTubeIframeAPIReady = () => resolve(window.YT);
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => {
        script.remove();
        reject(new Error("YouTube player API unavailable"));
      };
      document.head.append(script);
    }).catch((error) => {
      youtubeApiLoading = null;
      throw error;
    });
  }
  return youtubeApiLoading;
}

function replacePlayerFrame(src) {
  const parent = playerFrame.parentElement;
  const next = playerFrame.cloneNode(false);
  next.src = src;
  if (youtubePlayer) {
    youtubePlayer.destroy();
    youtubePlayer = null;
  }
  playerFrame.remove();
  parent.append(next);
  playerFrame = next;
  return next;
}


function playSelectedVideo(videoId, muted = true) {
  const frame = replacePlayerFrame(getPlayerUrl(videoId, muted));
  let retriedMuted = muted;
  loadYouTubeApi().then((api) => {
    if (playerFrame !== frame) return;
    youtubePlayer = new api.Player(frame.id, {
      events: {
        onReady(event) {
          if (playerFrame === frame) event.target.playVideo();
        },
        onAutoplayBlocked(event) {
          if (playerFrame !== frame) return;
          if (!retriedMuted) {
            retriedMuted = true;
            event.target.mute();
            event.target.playVideo();
          } else {
            playbackStatus.textContent = "영상의 재생 버튼을 눌러 주세요.";
          }
        },
        onStateChange(event) {
          if (playerFrame !== frame) return;
          if (event.data === api.PlayerState.ENDED) {
            playbackStatus.textContent = "영상이 끝났어요.";
          } else if (event.data === api.PlayerState.PLAYING && retriedMuted) {
            playbackStatus.textContent = event.target.isMuted()
              ? "무음으로 재생 중이에요. 영상에서 소리를 켤 수 있어요."
              : "영상 재생 중";
          }
        },
        onError() {
          if (playerFrame !== frame) return;
          playbackStatus.textContent = "영상을 재생할 수 없어요.";
        }
      }
    });
  }).catch(() => {});
}

function ensureAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return false;
  try {
    if (!audioContext) {
      const context = new AudioContext();
      const gain = context.createGain();
      gain.gain.value = 0.16;
      gain.connect(context.destination);
      audioContext = context;
      audioGainNode = gain;
    }

    if (audioContext.state === "suspended") {
      audioContext.resume()?.catch(() => {});
    }
    return true;
  } catch {
    return false;
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
  if (!ensureAudioContext()) return;

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
  stopSpinMusic();
  if (!ensureAudioContext()) return;

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

function loadVideos(preservePlayback = false) {
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

  if (!parsed.length) {
    updateStatus("유튜브 링크를 한 개 이상 등록해 주세요.");
    spinButton.disabled = true;
    pickButton.disabled = true;
    return;
  }

  videos = parsed;
  const videoCount = document.getElementById("video-count");
  videoCount.textContent = `불러온 영상 ${videos.length}개`;
  videoCount.hidden = false;
  resetRoulettePosition(videos.length === 1 ? videos : buildRouletteSequence());
  spinButton.disabled = false;
  pickButton.disabled = false;
  if (!preservePlayback) {
    setWinner(null);
    replacePlayerFrame("about:blank");
    playbackStatus.textContent = "";
  }
  updateStatus("");
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
  if (spinning || !videos.length) {
    return;
  }

  spinning = true;
  spinButton.disabled = true;
  pickButton.disabled = true;
  registerButton.disabled = true;
  playbackStatus.textContent = "룰렛이 돌아가는 중...";

  const winnerIndex = Math.floor(Math.random() * videos.length);
  const sequence = buildRouletteSequence();
  resetRoulettePosition(sequence);

  const winnerCard = rouletteStrip.children[videos.length * 5 + winnerIndex];

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const cardBounds = winnerCard.getBoundingClientRect();
      const stripLeft = rouletteStrip.getBoundingClientRect().left;
      const shellCenter = rouletteStrip.parentElement.clientWidth / 2;
      const offset = shellCenter - (cardBounds.left - stripLeft + cardBounds.width / 2);
      rouletteStrip.style.transition = "transform 4.5s cubic-bezier(0.14, 0.82, 0.18, 1)";
      rouletteStrip.style.transform = `translateX(${offset}px)`;
    });
  });

  window.setTimeout(() => {
    const winner = videos[winnerIndex];
    stopSpinMusic();
    setWinner(winner);
    playbackStatus.textContent = `${winner.title} 당첨!`;
    spinning = false;
    spinButton.disabled = false;
    pickButton.disabled = false;
    registerButton.disabled = false;
    try {
      playSelectedVideo(winner.id, false);
    } catch {
      playbackStatus.textContent = "영상을 재생할 수 없어요.";
    }
    playWinnerChime();
  }, 4600);
  startSpinMusic();
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
  if (!ensureAudioContext()) return;
  const start = audioContext.currentTime;
  if (correct) {
    playMalletStrike(start, [[784, 0.21, 0.25], [2352, 0.07, 0.1], [4916, 0.025, 0.05]]);
    playMalletStrike(start + 0.18, [[659, 0.21, 0.25], [1977, 0.07, 0.1], [4132, 0.025, 0.05]]);
    playMalletStrike(start + 0.36, [[523, 0.21, 0.42], [1569, 0.07, 0.14], [3279, 0.025, 0.07]]);
  } else {
    playMalletStrike(start, [[932, 0.19, 0.18], [2796, 0.095, 0.075], [4680, 0.035, 0.035]]);
  }
}

function buildQuestions(settings) {
  if (settings.operation === "multiplication" && settings.timesTable) {
    return Array.from({ length: 9 }, (_, index) => [Number(settings.table), index + 1]);
  }
  const addition = settings.operation === "addition";
  const limit = {
    addition: settings.addFive ? 5 : 9,
    subtraction: settings.subtractFive ? 5 : settings.subtractTen ? 10 : 20,
    multiplication: settings.multiplyTen ? 10 : 20,
    division: settings.divideTen ? 10 : 20
  }[settings.operation];
  const questions = [];
  for (let left = 1; left <= limit; left += 1) {
    for (let right = 1; right <= left; right += 1) {
      if (addition && settings.sumTen && left + right > 10) continue;
      if (settings.operation === "division" && left % right !== 0) continue;
      questions.push([left, right]);
    }
  }
  return questions;
}

function buildAnswerChoices(answer) {
  const positions = Math.min(answer, 2) + 1;
  const first = answer - Math.floor(Math.random() * positions);
  return [first, first + 1, first + 2];
}

function showNextQuestion() {
  const addition = subject.operation === "addition";
  const choices = quizQuestions.filter((question) => !recentQuestions.includes(question));
  const question = choices[Math.floor(Math.random() * choices.length)];
  const historySize = Math.min(requiredQuizStreak(), quizQuestions.length) - 1;
  recentQuestions = [...recentQuestions, question].slice(-historySize);
  const canSwap = addition || (subject.operation === "multiplication" && !subject.timesTable);
  const [left, right] = canSwap && Math.random() < 0.5 ? [...question].reverse() : question;
  const operation = operations[subject.operation];
  expectedAnswer = operation.answer(left, right);
  quizEquation.textContent = `${left} ${operation.sign} ${right} = ?`;
  renderAnswerButtons(buildAnswerChoices(expectedAnswer));
}

function renderAnswerButtons(values) {
  quizAnswers.replaceChildren(...values.map((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.value = button.textContent = String(value);
    button.addEventListener("click", () => checkQuizAnswer(button));
    return button;
  }));
}

function openQuiz(video = null) {
  if (spinning || quiz.open || (video ? pickButton.disabled : spinButton.disabled)) {
    return;
  }

  correctStreak = 0;
  quizVideo = video;
  loadYouTubeApi().catch(() => {});
  recentQuestions = [];
  quizQuestions = buildQuestions(subject);
  const operation = operations[subject.operation];
  document.getElementById("quiz-title").textContent = `${operation.title} 퀴즈`;
  clearQuizResult();
  quizFeedback.textContent = "";
  updateQuizProgress();
  showNextQuestion();
  quiz.showModal();
  quizAnswers.firstElementChild.focus();
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

function renderFamilyControls() {
  familyJoin.hidden = Boolean(family);
  familyConnected.hidden = !family;
  familyActiveCode.value = family?.code ?? "";
}

function restoreFamily() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(FAMILY_STORAGE_KEY));
    if (FAMILY_CODE_PATTERN.test(saved?.code) && typeof saved.urls === "string") {
      family = saved;
      urlsTextarea.value = saved.urls;
      loadVideos(true);
      familyStatus.textContent = "가족 목록에 연결되어 있어요.";
    }
  } catch {
    familyStatus.textContent = "이 기기에서 가족 연결 정보를 읽을 수 없어요.";
  }
  renderFamilyControls();
}

async function requestFamily(action, code, videoIds) {
  const response = await fetch(FAMILY_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, code, videoIds, codeFormat: action === "create" ? "short" : undefined }),
    signal: AbortSignal.timeout(8000)
  });
  if (response.status === 404) {
    throw new Error("가족 코드를 찾을 수 없어요. 코드를 다시 확인해 주세요.");
  }
  if (!response.ok) throw new Error("가족 목록을 연결하거나 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
  return response.json();
}

function updateFamilyList(code, videoIds, replaceInput) {
  const urls = videoIds.map((id) => `https://youtu.be/${id}`).join("\n");
  familyReloadPending = familyReloadPending || urls !== family?.urls;
  family = { code, urls };
  window.localStorage.setItem(FAMILY_STORAGE_KEY, JSON.stringify(family));
  if (replaceInput && urlsTextarea.value !== urls) {
    urlsTextarea.value = urls;
    if (registerDialog.open) renderRegisteredVideos();
  }
  if (familyReloadPending && urlsTextarea.value === urls && !spinning && !quiz.open && !videoPicker.open) {
    loadVideos(true);
    familyReloadPending = false;
  }
}

async function changeFamily(action) {
  if (familyBusy) return;
  const draft = urlsTextarea.value;
  const code = action === "join" ? familyCodeInput.value.trim().toLowerCase() : family?.code;
  const videoIds = action === "join" ? undefined :
    parseRawUrls(draft).map((url) => sanitizeVideoId(extractVideoId(url)));
  if (action === "join" && !FAMILY_CODE_PATTERN.test(code)) {
    familyStatus.textContent = "가족 코드를 다시 확인해 주세요.";
    return;
  }
  if (videoIds && (videoIds.length < 1 || videoIds.length > 50 || videoIds.some((id) => !id))) {
    familyStatus.textContent = "유튜브 링크를 한 줄에 하나씩 1~50개 넣어 주세요.";
    if (action === "save") updateStatus(familyStatus.textContent);
    return;
  }

  familyGeneration += 1;
  familyBusy = true;
  for (const button of [saveButton, familyCreate, familyConnect, familyDisconnect]) button.disabled = true;
  familyStatus.textContent = action === "save" ? "가족 목록 저장 중…" : "가족 목록 연결 중…";
  try {
    const result = await requestFamily(action === "join" ? "read" : action, code, videoIds);
    updateFamilyList(result.code ?? code, result.videoIds, urlsTextarea.value === draft);
    renderFamilyControls();
    familyStatus.textContent = action === "save" ? "가족 목록에 저장했어요." : "가족 목록에 연결했어요.";
  } catch (error) {
    familyStatus.textContent = error.name === "Error" ? error.message : "네트워크를 확인하고 다시 시도해 주세요.";
  } finally {
    familyBusy = false;
    for (const button of [saveButton, familyCreate, familyConnect, familyDisconnect]) button.disabled = false;
    if (action === "save") updateStatus(familyStatus.textContent);
  }
}

async function refreshFamily() {
  if (!family || familyBusy || familyRefreshing || spinning || quiz.open || videoPicker.open ||
      document.hidden || urlsTextarea.value !== family.urls) return;
  const { code, urls } = family;
  const generation = familyGeneration;
  familyRefreshing = true;
  try {
    const result = await requestFamily("read", code);
    if (generation !== familyGeneration || urlsTextarea.value !== urls ||
        spinning || quiz.open || videoPicker.open) return;
    updateFamilyList(code, result.videoIds, true);
    familyStatus.textContent = "가족 목록에 연결되어 있어요.";
  } catch {
    if (generation === familyGeneration) familyStatus.textContent = "가족 목록을 새로 가져오지 못했어요.";
  } finally {
    familyRefreshing = false;
  }
}

spinButton.addEventListener("click", () => openQuiz());
pickButton.addEventListener("click", openVideoPicker);
pickerClose.addEventListener("click", () => videoPicker.close());
function showSubjectOptions() {
  for (const operation of Object.keys(operations)) {
    document.getElementById(`${operation}-options`).hidden = subjectFields.operation.value !== operation;
  }
  document.getElementById("table-options").hidden = !subjectFields.timesTable.checked;
  subjectFields.multiplyTen.disabled = subjectFields.timesTable.checked;
}

function fillSubjectForm(settings) {
  subjectFields.operation.value = settings.operation;
  for (const key of Object.keys(defaultSubject)) {
    if (typeof defaultSubject[key] === "boolean") subjectFields[key].checked = settings[key];
  }
  subjectFields.table.value = settings.table;
  showSubjectOptions();
}

document.getElementById("subject-button").addEventListener("click", () => {
  subjectDialog.returnValue = "";
  fillSubjectForm(subject);
  subjectDialog.showModal();
});
document.getElementById("subject-reset").addEventListener("click", () => fillSubjectForm(defaultSubject));
subjectForm.addEventListener("change", showSubjectOptions);
subjectDialog.addEventListener("close", () => {
  if (subjectDialog.returnValue !== "save") return;
  subject.operation = subjectFields.operation.value;
  for (const key of Object.keys(defaultSubject)) {
    if (typeof defaultSubject[key] === "boolean") subject[key] = subjectFields[key].checked;
  }
  subject.table = subjectFields.table.value;
  try { localStorage.setItem(SUBJECT_KEY, JSON.stringify(subject)); } catch {}
});
quizClose.addEventListener("click", () => quiz.close());
quiz.addEventListener("close", () => {
  if (!quiz.open && quizFeedbackTimer !== null) {
    clearQuizResult();
  }
});
saveButton.addEventListener("click", () => family ? changeFamily("save") : saveUrlsToStorage());
familyJoin.addEventListener("submit", (event) => {
  event.preventDefault();
  changeFamily("join");
});
familyCreate.addEventListener("click", () => changeFamily("create"));
familyCopy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(family.code);
    familyStatus.textContent = "가족 코드를 복사했어요.";
  } catch {
    familyActiveCode.select();
    familyStatus.textContent = "가족 코드가 선택됐어요.";
  }
});
familyDisconnect.addEventListener("click", () => {
  familyGeneration += 1;
  family = null;
  familyReloadPending = false;
  window.localStorage.removeItem(FAMILY_STORAGE_KEY);
  familyCodeInput.value = "";
  renderFamilyControls();
  restoreSavedUrls();
  if (!spinning && !quiz.open && !videoPicker.open) loadVideos(true);
  familyStatus.textContent = "이 기기의 연결을 해제했어요.";
});
window.addEventListener("focus", refreshFamily);
document.addEventListener("visibilitychange", refreshFamily);
window.setInterval(refreshFamily, 15000);
const MAX_REGISTERED_VIDEOS = 20;

function registrationIsFull(urls) {
  if (urls.length < MAX_REGISTERED_VIDEOS) return false;
  registerStatus.textContent = "영상은 최대 20개까지 등록할 수 있어요. 기존 영상을 삭제한 뒤 추가해 주세요.";
  return true;
}

function renderRegisteredVideos() {
  const urls = parseRawUrls(urlsTextarea.value);
  const add = document.createElement("button");
  add.type = "button";
  add.className = "video-add-tile";
  add.textContent = "+";
  add.setAttribute("aria-label", "새 영상 추가");
  add.addEventListener("click", () => {
    if (registrationIsFull(parseRawUrls(urlsTextarea.value))) return;
    registerStatus.textContent = "";
    videoAddForm.hidden = false;
    newVideoUrl.focus();
  });
  registeredVideos.replaceChildren(add);
  urls.forEach((url, index) => {
    const id = sanitizeVideoId(extractVideoId(url));
    const card = document.createElement("article");
    card.className = "registered-video";
    const title = document.createElement("span");
    title.textContent = `영상 ${index + 1}`;
    if (id) {
      const thumbnail = document.createElement("img");
      thumbnail.src = buildVideoModel(id, index).thumbnail;
      thumbnail.alt = "";
      thumbnail.loading = "lazy";
      card.append(thumbnail);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "video-remove";
    remove.textContent = "\u00d7";
    remove.setAttribute("aria-label", `영상 ${index + 1} 삭제`);
    remove.addEventListener("click", () => {
      urls.splice(index, 1);
      urlsTextarea.value = urls.join("\n");
      renderRegisteredVideos();
      registeredVideos.querySelectorAll(".video-remove")[index]?.focus();
      if (!registeredVideos.contains(document.activeElement)) registeredVideos.firstElementChild.focus();
      registerStatus.textContent = "영상이 목록에서 빠졌어요. 저장하기를 누르면 저장돼요.";
    });
    card.append(title, remove);
    registeredVideos.append(card);
  });
}

function closeVideoAdd() {
  videoAddForm.reset();
  videoAddForm.hidden = true;
  registeredVideos.firstElementChild.focus();
}

videoAddForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = sanitizeVideoId(extractVideoId(newVideoUrl.value));
  if (!id) {
    registerStatus.textContent = "유튜브 영상 링크를 확인해 주세요.";
    newVideoUrl.focus();
    return;
  }
  const urls = parseRawUrls(urlsTextarea.value);
  if (registrationIsFull(urls)) return;
  if (urls.some((url) => extractVideoId(url) === id)) {
    registerStatus.textContent = "이미 등록된 영상이에요.";
    return;
  }
  urlsTextarea.value = [...urls, `https://youtu.be/${id}`].join("\n");
  renderRegisteredVideos();
  closeVideoAdd();
  registerStatus.textContent = "영상을 추가했어요. 저장하기를 누르면 저장돼요.";
});
document.getElementById("cancel-video-add").addEventListener("click", closeVideoAdd);
registerButton.addEventListener("click", () => {
  videoAddForm.reset();
  videoAddForm.hidden = true;
  renderRegisteredVideos();
  registerStatus.textContent = "";
  registerDialog.showModal();
});
registerDialog.addEventListener("close", () => {
  if (familyBusy) return;
  if (family) urlsTextarea.value = family.urls;
  else restoreSavedUrls();
  refreshFamily();
});
document.getElementById("sync-button").addEventListener("click", () => {
  document.getElementById("sync-dialog").showModal();
});
updateServerNote();
redirectToLocalServer();
setWinner(null);
restoreSavedUrls();
restoreFamily();
if (!videos.length) loadVideos();
if (!videos.length) {
  resetRoulettePosition(buildPlaceholderVideos());
}
refreshFamily();
