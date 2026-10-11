import { journalStore } from "./store.js";
import {
  MOODS,
  SPLASH_FADE_MS,
  SPLASH_MESSAGES,
  SPLASH_VISIBLE_MS,
  WRITING_PROMPTS,
  calculateStreak,
  contentToText,
  escapeHtml,
  formatEntryDate,
  formatEntryTime,
  getWordCount,
  groupEntriesByDate,
  isPrimaryShortcut,
  isRedoShortcut,
  isUndoShortcut,
  normalizeTags,
  parseDateKey,
  searchEntries,
  selectSplashMessage,
  selectWritingPrompt,
  shortcutModifierLabel,
  toDateKey,
} from "./utils.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  appShell: $(".app-shell"),
  workspace: $("#workspace"),
  journalPanel: $("#journal-panel"),
  listPane: $("#list-pane"),
  splash: $("#splash-screen"),
  splashMessage: $("#splash-message"),
  splashSource: $("#splash-source"),
  searchShortcutLabel: $("#search-shortcut-label"),
  search: $("#search-input"),
  entryList: $("#entry-list"),
  emptyList: $("#empty-list"),
  listTitle: $("#list-title"),
  editorPlaceholder: $("#editor-placeholder"),
  editorPane: $("#editor-pane"),
  form: $("#entry-form"),
  date: $("#entry-date"),
  title: $("#entry-title"),
  content: $("#entry-content"),
  tags: $("#entry-tags"),
  moodPicker: $("#mood-picker"),
  favoriteButton: $("#favorite-button"),
  saveStatus: $("#save-status"),
  editorWordCount: $("#editor-word-count"),
  calendarTitle: $("#calendar-title"),
  calendarGrid: $("#calendar-grid"),
  entryCount: $("#entry-count"),
  streakCount: $("#streak-count"),
  wordCount: $("#word-count"),
  allCount: $("#all-count"),
  favoriteCount: $("#favorite-count"),
  sidebar: $("#sidebar"),
  clearDateFilter: $("#clear-date-filter"),
  dashboardDateTitle: $("#dashboard-date-title"),
  dailyPrompt: $("#daily-prompt"),
  promptAnswer: $("#prompt-answer"),
  promptDraftStatus: $("#prompt-draft-status"),
  promptShuffleButton: $("#prompt-shuffle-button"),
  promptWriteButton: $("#prompt-write-button"),
  widgetSettingsButton: $("#widget-settings-button"),
  widgetSettingsDialog: $("#widget-settings-dialog"),
  homeWidgetStart: $("#home-widget-start"),
  homeWidgetEnd: $("#home-widget-end"),
  reflectionWidget: $("#reflection-widget"),
  reflectionCount: $("#reflection-count"),
  reflectionDescription: $("#reflection-description"),
  reflectionOpenButton: $("#reflection-open-button"),
  musicWidget: $("#music-widget"),
  musicWidgetEyebrow: $("#music-widget-eyebrow"),
  musicConnectionStatus: $("#music-connection-status"),
  musicTrackTitle: $("#music-track-title"),
  musicTrackArtist: $("#music-track-artist"),
  musicOpenButton: $("#music-open-button"),
  musicPlayButton: $("#music-play-button"),
  musicNextButton: $("#music-next-button"),
  musicSettingDescription: $("#music-setting-description"),
  musicPermissionDetail: $("#music-permission-detail"),
  musicSettingsFootnote: $("#music-settings-footnote"),
  breathingWidget: $("#breathing-widget"),
  breathingVisual: $("#breathing-visual"),
  breathingLabel: $("#breathing-label"),
  breathingTime: $("#breathing-time"),
  breathingToggleButton: $("#breathing-toggle-button"),
  backupDialog: $("#backup-dialog"),
  mediaDialog: $("#media-dialog"),
  mediaDialogTitle: $("#media-dialog-title"),
  stickerPanel: $("#sticker-panel"),
  imagePanel: $("#image-panel"),
  emojiGrid: $("#emoji-grid"),
  customStickerGrid: $("#custom-sticker-grid"),
  customStickerEmpty: $("#custom-sticker-empty"),
  stickerUploadInput: $("#sticker-upload-input"),
  imageUploadInput: $("#image-upload-input"),
  stickerOnlineResults: $("#sticker-online-results"),
  imageOnlineResults: $("#image-online-results"),
  stickerOnlineStatus: $("#sticker-online-status"),
  imageOnlineStatus: $("#image-online-status"),
  deleteDialog: $("#delete-dialog"),
  importInput: $("#import-input"),
  toast: $("#toast"),
};

const emojiLibrary = [
  ["😊", "微笑 开心 温柔"], ["😂", "大笑 笑哭"], ["🥰", "喜欢 爱 幸福"],
  ["😍", "心动 喜欢"], ["🥳", "庆祝 派对"], ["🤗", "拥抱 安慰"],
  ["🥹", "感动 忍泪"], ["😭", "哭 难过"], ["😢", "伤心 低落"],
  ["😮", "惊讶"], ["🤔", "思考 疑问"], ["😴", "睡觉 困"],
  ["😌", "放松 平静"], ["😎", "酷 自信"], ["🤭", "偷笑 害羞"],
  ["😳", "害羞 脸红"], ["🤯", "震惊"], ["😤", "生气 不服"],
  ["👍", "赞 同意"], ["👏", "鼓掌"], ["🙌", "万岁 成功"],
  ["🙏", "感谢 拜托"], ["💪", "加油 力量"], ["🫶", "爱心 比心"],
  ["❤️", "爱 红心"], ["🧡", "温暖 橙心"], ["💚", "自然 绿心"],
  ["🌟", "星星 闪耀"], ["✨", "闪耀 美好"], ["🌈", "彩虹 希望"],
  ["☀️", "太阳 晴天"], ["🌙", "月亮 夜晚"], ["🌧️", "下雨 雨天"],
  ["🌿", "叶子 平静"], ["🌸", "花 春天"], ["🌻", "向日葵 夏天"],
  ["🐱", "猫 可爱"], ["🐶", "狗 可爱"], ["🐻", "小熊"],
  ["☕️", "咖啡 休息"], ["🍰", "蛋糕 甜品"], ["🍻", "干杯 放松"],
  ["🎧", "音乐 耳机"], ["📚", "读书 学习"], ["📷", "相机 记录"],
  ["🚀", "出发 目标"], ["🎉", "庆祝 彩带"], ["🎁", "礼物 惊喜"],
];

const CUSTOM_STICKERS_KEY = "customStickers";
const PROMPT_DRAFT_STORAGE_KEY = "dayleaf.prompt-draft.v1";
const LAST_PROMPT_INDEX_KEY = "lastWritingPromptIndex";
const HOME_WIDGETS_KEY = "homeWidgets";
const HOME_WIDGET_IDS = ["reflection", "music", "breathing"];
const MUSIC_PROVIDER_KEY = "musicProvider";
const MUSIC_PROVIDERS = Object.freeze({
  appleMusic: Object.freeze({
    name: "Apple Music",
    mode: "full",
    description: "读取当前曲名并发送播放、暂停和下一首控制；不会读取资料库或播放历史。",
    permission: "完整联动会在开启时请求 macOS“自动化”权限。",
  }),
  netease: Object.freeze({
    name: "网易云音乐",
    mode: "launchOnly",
    description: "从日叶一键打开网易云音乐，写作时快速回到你的歌单。",
    permission: "当前 Mac 版未提供公开曲控接口；日叶不会申请辅助功能权限或模拟按键。",
  }),
  qqMusic: Object.freeze({
    name: "QQ 音乐",
    mode: "launchOnly",
    description: "从日叶一键打开 QQ 音乐，播放操作留在播放器内完成。",
    permission: "当前 Mac 版没有可依赖的公开曲控接口；日叶不会申请辅助功能权限或模拟按键。",
  }),
});
const MAX_CUSTOM_STICKERS = 12;
const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_MEDIA_DATA_CHARACTERS = 3_200_000;
const MAX_EDITOR_HISTORY_STATES = 60;
const MAX_EDITOR_HISTORY_CHARACTERS = 8_000_000;
const EDITOR_HISTORY_COALESCE_MS = 850;
const DATA_IMAGE_PATTERN = /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z\d+/=\s]+$/i;
const ALLOWED_RICH_TAGS = new Set(["B", "BR", "DIV", "EM", "I", "IMG", "P", "S", "SPAN", "STRONG", "U"]);

const state = {
  view: "home",
  selectedId: null,
  homeDate: toDateKey(),
  query: "",
  filter: "all",
  dateFilter: null,
  monthCursor: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  saveTimer: null,
  isDirty: false,
  saveFailed: false,
  editorRange: null,
  editorEntryId: null,
  mediaEntryId: null,
  mediaOperationId: 0,
  mediaOperationController: null,
  openverseResults: { sticker: [], image: [] },
  openverseControllers: { sticker: null, image: null },
  forceNextSaveFailure: false,
  forceHistoryCheckpoint: false,
  restoringHistory: false,
  promptIndex: -1,
  promptText: "",
  promptDate: toDateKey(),
  promptDraftTimer: null,
  promptDraftPending: false,
  promptDraftSaveFailed: false,
  homeWidgets: { reflection: false, music: false, breathing: false },
  reflectionDates: [],
  music: {
    provider: "appleMusic",
    mode: "full",
    capabilities: { openApp: true, nowPlaying: true, playPause: true, next: true },
    generation: 0,
    pollTimer: null,
    inFlight: false,
    authorizing: false,
    authorization: "unknown",
    phase: "idle",
    running: false,
    playing: false,
    title: "",
    artist: "",
  },
  breathing: {
    timer: null,
    running: false,
    endsAt: 0,
    remainingMs: 60_000,
  },
  editorHistory: {
    entryId: null,
    states: [],
    index: -1,
    lastInputAt: 0,
    lastInputType: "",
  },
};

const splashState = {
  phase: "visible",
  quoteIndex: -1,
  startedAt: null,
  dismissedAt: null,
  hiddenAt: null,
  timer: null,
  finishTimer: null,
  clockStarted: false,
  appReady: false,
  reducedMotion: false,
};

function prepareSplash() {
  const message = selectSplashMessage();
  splashState.quoteIndex = message.index;
  splashState.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  elements.splashMessage.textContent = message.text;
  elements.splashSource.textContent = message.source;
  elements.splash.dataset.quoteIndex = String(message.index);
  elements.appShell.setAttribute("aria-hidden", "true");
  elements.appShell.setAttribute("inert", "");
}

function finishSplash() {
  if (splashState.phase === "hidden") return;
  clearTimeout(splashState.timer);
  clearTimeout(splashState.finishTimer);
  splashState.phase = "hidden";
  splashState.hiddenAt = performance.now();
  elements.splash.hidden = true;
  elements.splash.classList.remove("is-leaving");
  document.body.classList.remove("splash-active", "splash-revealing");
  elements.appShell.removeAttribute("aria-hidden");
  elements.appShell.removeAttribute("inert");
  clearTimeout(window.__dayleafSplashFallback);
}

function beginSplashDismissal() {
  if (splashState.phase !== "visible") return;
  splashState.phase = "leaving";
  splashState.dismissedAt = performance.now();
  elements.appShell.removeAttribute("aria-hidden");
  elements.appShell.removeAttribute("inert");
  document.body.classList.add("splash-revealing");
  elements.splash.classList.add("is-leaving");
  splashState.finishTimer = setTimeout(
    finishSplash,
    splashState.reducedMotion ? 40 : SPLASH_FADE_MS,
  );
}

function startSplashClock() {
  if (splashState.clockStarted || splashState.phase !== "visible") return false;
  splashState.clockStarted = true;
  const beginClock = () => {
    if (splashState.phase !== "visible" || splashState.startedAt !== null) return;
    splashState.startedAt = performance.now();
    splashState.timer = setTimeout(beginSplashDismissal, SPLASH_VISIBLE_MS);
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(beginClock);
  });
  setTimeout(beginClock, 80);
  return true;
}

function getSplashState() {
  const now = performance.now();
  const visibleUntil = splashState.dismissedAt ?? now;
  return {
    phase: splashState.phase,
    quoteIndex: splashState.quoteIndex,
    quoteCount: SPLASH_MESSAGES.length,
    quote: elements.splashMessage.textContent,
    source: elements.splashSource.textContent,
    plannedDuration: SPLASH_VISIBLE_MS + SPLASH_FADE_MS,
    visibleDuration: splashState.startedAt === null
      ? 0
      : Math.max(0, visibleUntil - splashState.startedAt),
    startedAt: splashState.startedAt,
    dismissedAt: splashState.dismissedAt,
    hiddenAt: splashState.hiddenAt,
    reducedMotion: splashState.reducedMotion,
    appReady: splashState.appReady,
    mainInert: elements.appShell.hasAttribute("inert"),
    splashHidden: elements.splash.hidden,
  };
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove("visible"), 2400);
}

function setSaveState(message, pending = false) {
  elements.saveStatus.textContent = message;
  elements.saveStatus.classList.toggle("pending", pending);
}

function currentEntry() {
  return state.selectedId ? journalStore.get(state.selectedId) : null;
}

function promptTargetDate() {
  return state.dateFilter || currentEntry()?.date || state.homeDate || toDateKey();
}

function formatPromptTarget(date) {
  if (date === toDateKey()) return "写给今天";
  const label = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
  }).format(parseDateKey(date));
  return `写给${label}`;
}

function readPromptDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(PROMPT_DRAFT_STORAGE_KEY) || "null");
    const answer = String(draft?.answer || "").slice(0, 800);
    const promptIndex = WRITING_PROMPTS.indexOf(String(draft?.prompt || ""));
    if (!answer.trim() || promptIndex < 0) return null;
    return {
      answer,
      date: /^\d{4}-\d{2}-\d{2}$/.test(draft?.date) ? draft.date : toDateKey(),
      prompt: WRITING_PROMPTS[promptIndex],
      promptIndex,
    };
  } catch {
    return null;
  }
}

function updatePromptControls() {
  const hasAnswer = Boolean(elements.promptAnswer.value.trim());
  elements.promptWriteButton.disabled = !hasAnswer;
  elements.promptShuffleButton.disabled = hasAnswer;
  elements.promptShuffleButton.title = hasAnswer
    ? "回答已保存为草稿，清空后可以换题"
    : "换一个问题";
  if (state.promptDraftSaveFailed) {
    elements.promptDraftStatus.textContent = "草稿未保存";
  } else if (state.promptDraftPending) {
    elements.promptDraftStatus.textContent = "正在保存草稿…";
  } else if (hasAnswer) {
    elements.promptDraftStatus.textContent = "草稿已保存在本机";
  } else {
    elements.promptDraftStatus.textContent = formatPromptTarget(state.promptDate || promptTargetDate());
  }
}

function flushPromptDraft() {
  clearTimeout(state.promptDraftTimer);
  state.promptDraftTimer = null;
  state.promptDraftPending = false;
  const answer = elements.promptAnswer.value.slice(0, 800);
  try {
    if (answer.trim()) {
      localStorage.setItem(PROMPT_DRAFT_STORAGE_KEY, JSON.stringify({
        answer,
        date: state.promptDate || promptTargetDate(),
        prompt: state.promptText,
        updatedAt: new Date().toISOString(),
      }));
    } else {
      localStorage.removeItem(PROMPT_DRAFT_STORAGE_KEY);
    }
    state.promptDraftSaveFailed = false;
    updatePromptControls();
    return true;
  } catch {
    state.promptDraftSaveFailed = true;
    updatePromptControls();
    return false;
  }
}

function schedulePromptDraftSave() {
  clearTimeout(state.promptDraftTimer);
  state.promptDraftPending = true;
  state.promptDraftSaveFailed = false;
  updatePromptControls();
  state.promptDraftTimer = setTimeout(flushPromptDraft, 320);
}

function setWritingPrompt({ text, index }, date = promptTargetDate()) {
  state.promptIndex = index;
  state.promptText = text;
  state.promptDate = date;
  elements.dailyPrompt.textContent = text;
  try {
    journalStore.setPreference(LAST_PROMPT_INDEX_KEY, index);
  } catch {
    // The prompt still works for this session if preferences cannot be saved.
  }
  updatePromptControls();
}

function chooseWritingPrompt() {
  if (elements.promptAnswer.value.trim()) return false;
  const previousIndex = state.promptIndex >= 0
    ? state.promptIndex
    : Number(journalStore.getPreference(LAST_PROMPT_INDEX_KEY, -1));
  setWritingPrompt(selectWritingPrompt(Math.random(), previousIndex));
  flushPromptDraft();
  return true;
}

function initializeWritingPrompt() {
  const draft = readPromptDraft();
  if (draft) {
    state.promptIndex = draft.promptIndex;
    state.promptText = draft.prompt;
    state.promptDate = draft.date;
    elements.dailyPrompt.textContent = draft.prompt;
    elements.promptAnswer.value = draft.answer;
    updatePromptControls();
    return;
  }
  chooseWritingPrompt();
}

function clearPromptDraft() {
  clearTimeout(state.promptDraftTimer);
  state.promptDraftTimer = null;
  state.promptDraftPending = false;
  state.promptDraftSaveFailed = false;
  elements.promptAnswer.value = "";
  try {
    localStorage.removeItem(PROMPT_DRAFT_STORAGE_KEY);
  } catch {}
  updatePromptControls();
}

function flushAll() {
  const entrySaved = flushSave();
  const promptSaved = flushPromptDraft();
  return entrySaved && promptSaved;
}

function normalizeHomeWidgets(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(HOME_WIDGET_IDS.map((id) => [id, source[id] === true]));
}

function normalizeMusicProvider(value) {
  return Object.hasOwn(MUSIC_PROVIDERS, value) ? value : "appleMusic";
}

function selectedMusicProvider() {
  return MUSIC_PROVIDERS[state.music.provider] || MUSIC_PROVIDERS.appleMusic;
}

function defaultMusicCapabilities(mode = selectedMusicProvider().mode) {
  const full = mode === "full";
  return { openApp: true, nowPlaying: full, playPause: full, next: full };
}

function nativeWidgetHandler() {
  return window.webkit?.messageHandlers?.dayleafWidgets || null;
}

async function requestNativeWidget(capability, action, { timeoutMs = 3500, payload = {} } = {}) {
  const handler = nativeWidgetHandler();
  if (!handler?.postMessage) {
    return { ok: false, code: "unsupported", data: {} };
  }
  let timeoutId;
  try {
    const response = await Promise.race([
      Promise.resolve(handler.postMessage({ version: 1, capability, action, ...payload })),
      new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve({ ok: false, code: "timeout", data: {} }), timeoutMs);
      }),
    ]);
    clearTimeout(timeoutId);
    return response && typeof response === "object"
      ? response
      : { ok: false, code: "invalidReply", data: {} };
  } catch {
    clearTimeout(timeoutId);
    return { ok: false, code: "bridgeError", data: {} };
  }
}

function requestMusicWidget(action, options = {}) {
  return requestNativeWidget("music", action, {
    ...options,
    payload: { provider: state.music.provider },
  });
}

function persistHomeWidgets(nextWidgets) {
  const previous = state.homeWidgets;
  state.homeWidgets = normalizeHomeWidgets(nextWidgets);
  try {
    journalStore.setPreference(HOME_WIDGETS_KEY, state.homeWidgets);
    return true;
  } catch (error) {
    state.homeWidgets = previous;
    showStorageError(error);
    return false;
  }
}

function selectMusicProvider(providerId) {
  const provider = normalizeMusicProvider(providerId);
  if (state.homeWidgets.music || state.music.authorizing || provider === state.music.provider) return false;
  const previous = state.music.provider;
  state.music.provider = provider;
  state.music.mode = MUSIC_PROVIDERS[provider].mode;
  state.music.capabilities = defaultMusicCapabilities(state.music.mode);
  try {
    journalStore.setPreference(MUSIC_PROVIDER_KEY, provider);
  } catch (error) {
    state.music.provider = previous;
    state.music.mode = MUSIC_PROVIDERS[previous].mode;
    state.music.capabilities = defaultMusicCapabilities(state.music.mode);
    showStorageError(error);
    return false;
  }
  clearMusicRuntime();
  renderHomeWidgets();
  return true;
}

function widgetLayout() {
  const start = state.homeWidgets.reflection;
  const end = state.homeWidgets.music || state.homeWidgets.breathing;
  if (start && end) return "both";
  if (start) return "start";
  if (end) return "end";
  return "none";
}

function setRailVisibility(rail, visible) {
  rail.hidden = !visible;
  rail.toggleAttribute("inert", !visible);
  rail.setAttribute("aria-hidden", String(!visible));
}

function renderReflectionWidget() {
  const current = parseDateKey(state.homeDate || toDateKey());
  const month = current.getMonth();
  const day = current.getDate();
  const currentYear = current.getFullYear();
  state.reflectionDates = [...new Set(journalStore.getAll()
    .filter((entry) => {
      const date = parseDateKey(entry.date);
      return date.getMonth() === month && date.getDate() === day && date.getFullYear() < currentYear;
    })
    .map((entry) => entry.date))];
  const count = journalStore.getAll().filter((entry) => state.reflectionDates.includes(entry.date)).length;
  elements.reflectionCount.textContent = count ? `${count} 篇旧时光` : "还没有往年记录";
  elements.reflectionDescription.textContent = count
    ? `来自 ${state.reflectionDates.length} 个往年同日，只展示数量，正文仍由你主动打开。`
    : "日子积累起来后，这里会替你打开同一天的旧时光。";
  elements.reflectionOpenButton.hidden = count === 0;
  elements.reflectionOpenButton.textContent = "打开最近一年";
}

function updateTextContent(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function applyMusicCapabilities(data = {}) {
  const reportedMode = data.mode === "full" || data.mode === "launchOnly" ? data.mode : selectedMusicProvider().mode;
  const defaults = defaultMusicCapabilities(reportedMode);
  const reported = data.capabilities && typeof data.capabilities === "object" ? data.capabilities : {};
  state.music.mode = reportedMode;
  state.music.capabilities = Object.fromEntries(
    Object.keys(defaults).map((key) => [key, typeof reported[key] === "boolean" ? reported[key] : defaults[key]]),
  );
}

function renderMusicWidget() {
  const music = state.music;
  const provider = selectedMusicProvider();
  const supported = Boolean(nativeWidgetHandler()?.postMessage);
  const fullControl = music.mode === "full" && music.capabilities.nowPlaying;
  const statusText = {
    requesting: "正在等待系统允许",
    permission: "需要你的系统允许",
    denied: "自动化权限未允许",
    unavailable: "仅支持独立 macOS 版",
    missing: `未找到${provider.name}`,
    timeout: "连接暂时没有回应",
    ready: music.running ? (music.playing ? "正在播放" : "已暂停") : "音乐尚未打开",
    limited: music.running ? "播放器已打开" : "播放器尚未打开",
    idle: supported ? "等待连接" : "仅支持独立 macOS 版",
  }[music.phase] || "等待连接";
  updateTextContent(elements.musicWidgetEyebrow, `${provider.name} · 音乐陪伴`);
  updateTextContent(elements.musicConnectionStatus, statusText);
  const fallbackTitle = music.phase === "missing"
    ? `${provider.name} 尚未安装`
    : (fullControl ? "让一段音乐陪你写作" : `让 ${provider.name} 陪你写作`);
  const fallbackArtist = supported
    ? (fullControl ? "打开音乐后，这里只显示当前曲目" : "播放和曲目信息保留在播放器内")
    : "网页版本不会访问本地软件";
  updateTextContent(elements.musicTrackTitle, music.title || fallbackTitle);
  updateTextContent(elements.musicTrackArtist, music.artist || fallbackArtist);
  updateTextContent(elements.musicOpenButton, ["permission", "denied"].includes(music.phase)
    ? "重新允许"
    : (music.running ? `前往${provider.name}` : `打开${provider.name}`));
  elements.musicPlayButton.hidden = !music.capabilities.playPause;
  elements.musicNextButton.hidden = !music.capabilities.next;
  elements.musicPlayButton.disabled = !music.running || music.phase !== "ready" || !music.capabilities.playPause;
  elements.musicNextButton.disabled = !music.running || music.phase !== "ready" || !music.capabilities.next;
  elements.musicPlayButton.setAttribute("aria-pressed", String(music.playing));
  elements.musicPlayButton.setAttribute("aria-label", music.playing ? "暂停音乐" : "播放音乐");
  elements.musicPlayButton.innerHTML = music.playing
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>';
}

function clearMusicRuntime() {
  state.music.generation += 1;
  clearTimeout(state.music.pollTimer);
  state.music.pollTimer = null;
  Object.assign(state.music, {
    inFlight: false,
    authorization: "unknown",
    mode: selectedMusicProvider().mode,
    capabilities: defaultMusicCapabilities(selectedMusicProvider().mode),
    phase: "idle",
    running: false,
    playing: false,
    title: "",
    artist: "",
  });
  renderMusicWidget();
}

async function refreshMusicStatus({ schedule = true, allowHidden = false } = {}) {
  if (
    !state.homeWidgets.music ||
    (!allowHidden && document.hidden) ||
    state.view !== "home" ||
    state.music.inFlight
  ) return;
  const generation = state.music.generation;
  const provider = state.music.provider;
  state.music.inFlight = true;
  const reply = await requestMusicWidget("status");
  if (generation !== state.music.generation || provider !== state.music.provider || !state.homeWidgets.music) return;
  state.music.inFlight = false;
  if (reply.ok) {
    applyMusicCapabilities(reply.data);
    Object.assign(state.music, {
      authorization: reply.data?.authorization || state.music.authorization,
      phase: state.music.mode === "full" ? "ready" : "limited",
      running: Boolean(reply.data?.running),
      playing: state.music.capabilities.playPause && Boolean(reply.data?.playing),
      title: state.music.capabilities.nowPlaying ? String(reply.data?.title || "").slice(0, 160) : "",
      artist: state.music.capabilities.nowPlaying ? String(reply.data?.artist || "").slice(0, 160) : "",
    });
  } else {
    state.music.phase = reply.code === "denied"
      ? "denied"
      : (reply.code === "needsPermission"
        ? "permission"
        : (reply.code === "appMissing" ? "missing" : (reply.code === "unsupported" ? "unavailable" : "timeout")));
    if (reply.code === "denied") state.music.authorization = "denied";
    Object.assign(state.music, { running: false, playing: false, title: "", artist: "" });
  }
  renderMusicWidget();
  clearTimeout(state.music.pollTimer);
  if (schedule && state.homeWidgets.music && !document.hidden && !["permission", "denied", "unavailable", "missing"].includes(state.music.phase)) {
    state.music.pollTimer = setTimeout(refreshMusicStatus, state.music.mode === "full" ? 6000 : 15000);
  }
}

async function authorizeMusicWidget() {
  if (state.music.authorizing) return false;
  if (!nativeWidgetHandler()?.postMessage) {
    state.music.phase = "unavailable";
    renderMusicWidget();
    showToast("音乐联动仅支持独立 macOS 版");
    return false;
  }
  state.music.authorizing = true;
  renderWidgetSettings();
  try {
  state.music.generation += 1;
  clearTimeout(state.music.pollTimer);
  state.music.pollTimer = null;
  state.music.inFlight = false;
  const generation = state.music.generation;
  const providerId = state.music.provider;
  const provider = selectedMusicProvider();
  state.music.phase = "requesting";
  renderMusicWidget();
  const openReply = await requestMusicWidget("openApp");
  if (generation !== state.music.generation || providerId !== state.music.provider) return false;
  if (!openReply.ok) {
    state.music.phase = openReply.code === "appMissing" ? "missing" : "timeout";
    renderMusicWidget();
    showToast(openReply.code === "appMissing" ? `这台 Mac 尚未安装${provider.name}` : `无法打开${provider.name}`);
    return false;
  }
  applyMusicCapabilities(openReply.data);

  if (state.music.mode !== "full") {
    if (!persistHomeWidgets({ ...state.homeWidgets, music: true })) return false;
    Object.assign(state.music, {
      authorization: "notNeeded",
      phase: "limited",
      running: true,
      playing: false,
      title: "",
      artist: "",
    });
    renderHomeWidgets();
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (generation === state.music.generation && providerId === state.music.provider) {
      await refreshMusicStatus({ schedule: true, allowHidden: true });
    }
    showToast(`${provider.name}已接入；播放请在播放器内控制`);
    return true;
  }

  let reply = { ok: false, code: "notRunning", data: {} };
  for (const waitMs of [350, 600, 900, 1200]) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    if (generation !== state.music.generation || providerId !== state.music.provider) return false;
    reply = await requestMusicWidget("authorize", { timeoutMs: 120_000 });
    if (reply.ok || reply.code !== "notRunning") break;
  }
  if (generation !== state.music.generation || providerId !== state.music.provider) return false;
  if (!reply.ok) {
    state.music.phase = reply.code === "denied" ? "denied" : "timeout";
    state.music.authorization = reply.code === "denied" ? "denied" : "unknown";
    renderMusicWidget();
    showToast(reply.code === "denied" ? "没有获得音乐自动化权限" : "暂时无法连接音乐");
    return false;
  }
  applyMusicCapabilities(reply.data);
  Object.assign(state.music, {
    authorization: reply.data?.authorization || "authorized",
    running: Boolean(reply.data?.running),
    playing: Boolean(reply.data?.playing),
    title: String(reply.data?.title || "").slice(0, 160),
    artist: String(reply.data?.artist || "").slice(0, 160),
  });
  if (!persistHomeWidgets({ ...state.homeWidgets, music: true })) return false;
  state.music.phase = "ready";
  renderHomeWidgets();
  await refreshMusicStatus();
  return true;
  } finally {
    state.music.authorizing = false;
    renderWidgetSettings();
  }
}

async function performMusicAction(action) {
  if (!state.homeWidgets.music) return;
  if (action !== "openApp" && !state.music.capabilities[action === "playPause" ? "playPause" : "next"]) {
    showToast(`请在${selectedMusicProvider().name}内控制播放`);
    return;
  }
  const reply = await requestMusicWidget(action);
  if (!reply.ok) {
    const provider = selectedMusicProvider();
    showToast(reply.code === "denied"
      ? `请在系统设置中允许日叶控制${provider.name}`
      : (reply.code === "appMissing" ? `这台 Mac 尚未安装${provider.name}` : `${provider.name}暂时没有回应`));
    state.music.phase = reply.code === "denied" ? "denied" : (reply.code === "appMissing" ? "missing" : "timeout");
    renderMusicWidget();
    return;
  }
  if (action === "openApp") {
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  await refreshMusicStatus({ schedule: true });
}

function breathingRemainingMs() {
  return state.breathing.running
    ? Math.max(0, state.breathing.endsAt - Date.now())
    : state.breathing.remainingMs;
}

function renderBreathingWidget() {
  const remaining = breathingRemainingMs();
  const seconds = Math.ceil(remaining / 1000);
  elements.breathingTime.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  elements.breathingVisual.classList.toggle("is-running", state.breathing.running);
  elements.breathingLabel.textContent = state.breathing.running
    ? (seconds > 30 ? "吸气，再慢慢呼气" : "把注意力带回此刻")
    : (remaining === 0 ? "这一分钟，留给了自己" : "准备好时，慢慢呼吸");
  elements.breathingToggleButton.textContent = state.breathing.running
    ? "暂停"
    : (remaining > 0 && remaining < 60_000 ? "继续" : "开始静心");
}

function updateBreathingTimer() {
  state.breathing.remainingMs = breathingRemainingMs();
  if (state.breathing.remainingMs <= 0) {
    clearInterval(state.breathing.timer);
    state.breathing.timer = null;
    state.breathing.running = false;
    state.breathing.remainingMs = 0;
    showToast("静心一分钟完成");
  }
  renderBreathingWidget();
}

function toggleBreathingTimer() {
  if (state.breathing.running) {
    state.breathing.remainingMs = breathingRemainingMs();
    state.breathing.running = false;
    clearInterval(state.breathing.timer);
    state.breathing.timer = null;
  } else {
    if (state.breathing.remainingMs <= 0) state.breathing.remainingMs = 60_000;
    state.breathing.running = true;
    state.breathing.endsAt = Date.now() + state.breathing.remainingMs;
    clearInterval(state.breathing.timer);
    state.breathing.timer = setInterval(updateBreathingTimer, 250);
  }
  renderBreathingWidget();
}

function renderWidgetSettings() {
  $$('[data-widget-enable]').forEach((button) => {
    const enabled = state.homeWidgets[button.dataset.widgetEnable];
    button.hidden = enabled;
    button.setAttribute("aria-pressed", String(enabled));
    const busy = button.dataset.widgetEnable === "music" && state.music.authorizing;
    button.disabled = busy;
    button.toggleAttribute("aria-busy", busy);
  });
  $$('[data-widget-disable]').forEach((button) => {
    const enabled = state.homeWidgets[button.dataset.widgetDisable];
    button.hidden = !enabled;
  });
  const supported = Boolean(nativeWidgetHandler()?.postMessage);
  const provider = selectedMusicProvider();
  const providerInputs = $$('[name="music-provider"]');
  providerInputs.forEach((input) => {
    input.checked = input.value === state.music.provider;
    input.disabled = state.homeWidgets.music || state.music.authorizing;
  });
  updateTextContent(elements.musicSettingDescription, provider.description);
  elements.musicPermissionDetail.textContent = supported
    ? provider.permission
    : "当前为网页版本；音乐联动仅在独立 macOS 版可用。";
  const musicEnableButton = $('[data-widget-enable="music"]');
  if (musicEnableButton) {
    musicEnableButton.textContent = provider.mode === "full" ? "允许并开启" : "打开并开启";
    musicEnableButton.setAttribute("aria-label", `${musicEnableButton.textContent}“${provider.name}”音乐陪伴小组件`);
  }
  elements.musicSettingsFootnote.textContent = state.homeWidgets.music
    ? `当前使用${provider.name}；关闭音乐陪伴后可切换播放器。`
    : (provider.mode === "full"
      ? "自动化权限可随时在“系统设置 → 隐私与安全性 → 自动化”中修改。"
      : "此模式只打开你选择的播放器，不读取曲名，也不发送播放指令。");
}

function renderHomeWidgets() {
  const homeVisible = state.view === "home";
  const startVisible = homeVisible && state.homeWidgets.reflection;
  const endVisible = homeVisible && (state.homeWidgets.music || state.homeWidgets.breathing);
  elements.workspace.dataset.widgetLayout = widgetLayout();
  elements.reflectionWidget.hidden = !state.homeWidgets.reflection;
  elements.musicWidget.hidden = !state.homeWidgets.music;
  elements.breathingWidget.hidden = !state.homeWidgets.breathing;
  setRailVisibility(elements.homeWidgetStart, startVisible);
  setRailVisibility(elements.homeWidgetEnd, endVisible);
  if (state.homeWidgets.reflection) renderReflectionWidget();
  if (state.homeWidgets.music) renderMusicWidget();
  if (state.homeWidgets.breathing) renderBreathingWidget();
  renderWidgetSettings();
}

async function enableHomeWidget(id) {
  if (!HOME_WIDGET_IDS.includes(id) || state.homeWidgets[id]) return false;
  if (id === "music") {
    return authorizeMusicWidget();
  }
  if (!persistHomeWidgets({ ...state.homeWidgets, [id]: true })) return false;
  renderHomeWidgets();
  showToast(id === "reflection" ? "往年今日已开启" : "静心一分钟已开启");
  return true;
}

function disableHomeWidget(id) {
  if (!HOME_WIDGET_IDS.includes(id) || !state.homeWidgets[id]) return false;
  const next = { ...state.homeWidgets, [id]: false };
  if (!persistHomeWidgets(next)) return false;
  if (id === "music") clearMusicRuntime();
  if (id === "breathing") {
    clearInterval(state.breathing.timer);
    Object.assign(state.breathing, { timer: null, running: false, endsAt: 0, remainingMs: 60_000 });
  }
  renderHomeWidgets();
  return true;
}

function initializeHomeWidgets() {
  state.homeWidgets = normalizeHomeWidgets(journalStore.getPreference(HOME_WIDGETS_KEY, {}));
  state.music.provider = normalizeMusicProvider(journalStore.getPreference(MUSIC_PROVIDER_KEY, "appleMusic"));
  state.music.mode = selectedMusicProvider().mode;
  state.music.capabilities = defaultMusicCapabilities(state.music.mode);
  state.music.phase = nativeWidgetHandler()?.postMessage ? "idle" : "unavailable";
  renderHomeWidgets();
}

function isSafeWebUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function isSafeHttpsUrl(value) {
  const url = isSafeWebUrl(value);
  return url && new URL(url).protocol === "https:" ? url : "";
}

function sanitizeRichContent(content) {
  const template = document.createElement("template");
  template.innerHTML = String(content || "");
  const dangerousTags = new Set(["EMBED", "IFRAME", "LINK", "MATH", "META", "OBJECT", "SCRIPT", "STYLE", "SVG", "TEMPLATE"]);

  [...template.content.querySelectorAll("*")].forEach((node) => {
    if (dangerousTags.has(node.tagName)) {
      node.remove();
      return;
    }
    if (!ALLOWED_RICH_TAGS.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }

    if (node.tagName === "IMG") {
      const source = node.getAttribute("src") || "";
      const alt = String(node.getAttribute("alt") || "").slice(0, 160);
      if (!DATA_IMAGE_PATTERN.test(source)) {
        node.replaceWith(document.createTextNode(alt ? `[​${alt}]` : ""));
        return;
      }

      const mediaKind = node.dataset.mediaKind === "sticker" ? "sticker" : "image";
      const safeAttributes = {
        src: source,
        alt,
        class: mediaKind === "sticker" ? "inline-sticker" : "diary-image",
        "data-media-kind": mediaKind,
      };
      const metadataLimits = {
        "data-attribution": 600,
        "data-openverse-id": 80,
        "data-source-url": 800,
        "data-creator-url": 800,
        "data-license-url": 800,
      };
      Object.entries(metadataLimits).forEach(([name, limit]) => {
        const raw = node.getAttribute(name);
        if (!raw) return;
        const value = name.endsWith("-url") ? isSafeWebUrl(raw) : String(raw).slice(0, limit);
        if (value) safeAttributes[name] = value.slice(0, limit);
      });
      const title = String(node.getAttribute("title") || safeAttributes["data-attribution"] || "").slice(0, 600);
      if (title) safeAttributes.title = title;
      [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));
      Object.entries(safeAttributes).forEach(([name, value]) => node.setAttribute(name, value));
      return;
    }

    const isCredit = node.tagName === "SPAN" && node.classList.contains("media-credit");
    [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));
    if (isCredit) {
      node.className = "media-credit";
      node.setAttribute("contenteditable", "false");
    }
  });

  const commentWalker = document.createTreeWalker(template.content, NodeFilter.SHOW_COMMENT);
  const comments = [];
  while (commentWalker.nextNode()) comments.push(commentWalker.currentNode);
  comments.forEach((comment) => comment.remove());
  return template.innerHTML;
}

function sanitizeImportedEntries(entries) {
  return entries.map((entry) => ({
    ...entry,
    content: entry?.contentFormat === "html"
      ? sanitizeRichContent(entry.content)
      : String(entry?.content || ""),
  }));
}

function entryBodyText(entry) {
  return contentToText(entry?.content, entry?.contentFormat);
}

function dataImageCharacterCount(value) {
  const pattern = /data:image\/(?:png|jpe?g|webp|gif);base64,[a-z\d+/=\s]+/gi;
  let total = 0;
  let match;
  while ((match = pattern.exec(String(value || "")))) total += match[0].length;
  return total;
}

function diaryMediaCharacterCount() {
  return journalStore.getAll().reduce((total, entry) => {
    if (entry.id === state.selectedId && !elements.form.hidden) {
      return total + dataImageCharacterCount(elements.content.innerHTML);
    }
    return total + (entry.contentFormat === "html" ? dataImageCharacterCount(entry.content) : 0);
  }, 0);
}

function stickerMediaCharacterCount(stickers = customStickers()) {
  return stickers.reduce((total, sticker) => total + String(sticker.dataUrl || "").length, 0);
}

function assertMediaBudget(additionalCharacters = 0, stickers = customStickers()) {
  const projected = diaryMediaCharacterCount() + stickerMediaCharacterCount(stickers) + additionalCharacters;
  if (projected > MAX_MEDIA_DATA_CHARACTERS) {
    throw new Error("图片存储即将超出本机安全上限，请先删除一张图片或表情包");
  }
}

function storageErrorMessage(error) {
  const fallback = "图片过大或本机存储空间不足，请删除一张图片后再试";
  return error?.name === "QuotaExceededError" ? fallback : (error?.message || fallback);
}

function isStorageError(error) {
  return error?.name === "QuotaExceededError" || /quota|storage|space|capacity/i.test(String(error?.message || ""));
}

function showStorageError(error) {
  showToast(storageErrorMessage(error));
}

function handleSaveError(error) {
  state.saveTimer = null;
  state.isDirty = true;
  state.saveFailed = true;
  setSaveState("保存失败");
  showStorageError(error);
}

function rangeBelongsToEditor(range) {
  if (!range || state.editorEntryId !== state.selectedId) return false;
  const container = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
    ? range.commonAncestorContainer.parentNode
    : range.commonAncestorContainer;
  return container === elements.content || elements.content.contains(container);
}

function captureEditorRange() {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!rangeBelongsToEditor(range)) return;
  state.editorRange = range.cloneRange();
  state.editorEntryId = state.selectedId;
}

function editorInsertionRange() {
  if (rangeBelongsToEditor(state.editorRange)) return state.editorRange.cloneRange();
  const range = document.createRange();
  range.selectNodeContents(elements.content);
  range.collapse(false);
  return range;
}

function setEditorCaret(range) {
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  state.editorRange = range.cloneRange();
  state.editorEntryId = state.selectedId;
}

function nextMeaningfulSibling(node) {
  let sibling = node?.nextSibling || null;
  while (sibling?.nodeType === Node.TEXT_NODE && !sibling.textContent.trim()) {
    sibling = sibling.nextSibling;
  }
  return sibling;
}

function isMediaLineBreak(node) {
  return node instanceof HTMLDivElement && [...node.childNodes].every((child) =>
    child instanceof HTMLBRElement ||
    (child.nodeType === Node.TEXT_NODE && !child.textContent.trim())
  );
}

function selectMediaGroup(image) {
  if (!(image instanceof HTMLImageElement) || !elements.content.contains(image)) return false;
  let lastNode = image;
  if (image.dataset.mediaKind === "sticker") {
    const spacer = image.nextSibling;
    if (spacer?.nodeType === Node.TEXT_NODE && !spacer.textContent.replaceAll("\u00a0", "").trim()) {
      lastNode = spacer;
    }
  } else {
    const credit = nextMeaningfulSibling(image);
    if (credit instanceof HTMLElement && credit.classList.contains("media-credit")) {
      lastNode = credit;
    }
    const lineBreak = nextMeaningfulSibling(lastNode);
    if (isMediaLineBreak(lineBreak)) lastNode = lineBreak;
  }

  const range = document.createRange();
  range.setStartBefore(image);
  range.setEndAfter(lastNode);
  setEditorCaret(range);
  return true;
}

function editorNodePath(node) {
  const path = [];
  let cursor = node;
  while (cursor && cursor !== elements.content) {
    const parent = cursor.parentNode;
    if (!parent) return null;
    const index = [...parent.childNodes].indexOf(cursor);
    if (index < 0) return null;
    path.unshift(index);
    cursor = parent;
  }
  return cursor === elements.content ? path : null;
}

function editorNodeAtPath(path) {
  let node = elements.content;
  for (const index of path || []) {
    node = node?.childNodes?.[index];
    if (!node) return null;
  }
  return node;
}

function editorSelectionSnapshot() {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!rangeBelongsToEditor(range)) return null;
  const startPath = editorNodePath(range.startContainer);
  const endPath = editorNodePath(range.endContainer);
  if (!startPath || !endPath) return null;
  return {
    startPath,
    startOffset: range.startOffset,
    endPath,
    endOffset: range.endOffset,
  };
}

function editorSnapshot() {
  return {
    html: elements.content.innerHTML,
    selection: editorSelectionSnapshot(),
  };
}

function resetEditorHistory() {
  state.editorHistory = {
    entryId: state.selectedId,
    states: state.selectedId ? [editorSnapshot()] : [],
    index: state.selectedId ? 0 : -1,
    lastInputAt: 0,
    lastInputType: "",
  };
  state.forceHistoryCheckpoint = false;
}

function updateCurrentHistorySelection() {
  const history = state.editorHistory;
  const snapshot = history.states[history.index];
  if (history.entryId !== state.selectedId || !snapshot) return;
  snapshot.selection = editorSelectionSnapshot();
}

function trimEditorHistory() {
  const history = state.editorHistory;
  const totalCharacters = () => history.states.reduce((total, item) => total + item.html.length, 0);
  while (
    history.states.length > 2 &&
    (history.states.length > MAX_EDITOR_HISTORY_STATES || totalCharacters() > MAX_EDITOR_HISTORY_CHARACTERS)
  ) {
    history.states.shift();
    history.index -= 1;
  }
}

function recordEditorHistory(event) {
  if (state.restoringHistory || !state.selectedId || elements.form.hidden) return;
  if (state.editorHistory.entryId !== state.selectedId) resetEditorHistory();
  const history = state.editorHistory;
  const snapshot = editorSnapshot();
  const current = history.states[history.index];
  if (current?.html === snapshot.html) {
    current.selection = snapshot.selection;
    state.forceHistoryCheckpoint = false;
    return;
  }

  history.states = history.states.slice(0, history.index + 1);
  const now = performance.now();
  const inputType = String(event?.inputType || "input");
  const textLikeInput = /^(?:deleteContentBackward|deleteContentForward|insertCompositionText|insertText)$/.test(inputType);
  const canCoalesce =
    !state.forceHistoryCheckpoint &&
    textLikeInput &&
    history.index > 0 &&
    /^(?:deleteContentBackward|deleteContentForward|insertCompositionText|insertText)$/.test(history.lastInputType) &&
    now - history.lastInputAt <= EDITOR_HISTORY_COALESCE_MS;

  if (canCoalesce) {
    history.states[history.index] = snapshot;
  } else {
    history.states.push(snapshot);
    history.index = history.states.length - 1;
  }
  history.lastInputAt = now;
  history.lastInputType = inputType;
  state.forceHistoryCheckpoint = false;
  trimEditorHistory();
}

function restoreEditorSelection(selectionSnapshot) {
  const range = document.createRange();
  const startNode = editorNodeAtPath(selectionSnapshot?.startPath);
  const endNode = editorNodeAtPath(selectionSnapshot?.endPath);
  try {
    if (!startNode || !endNode) throw new Error("missing selection node");
    const startLimit = startNode.nodeType === Node.TEXT_NODE
      ? startNode.textContent.length
      : startNode.childNodes.length;
    const endLimit = endNode.nodeType === Node.TEXT_NODE
      ? endNode.textContent.length
      : endNode.childNodes.length;
    range.setStart(startNode, Math.min(selectionSnapshot.startOffset, startLimit));
    range.setEnd(endNode, Math.min(selectionSnapshot.endOffset, endLimit));
  } catch {
    range.selectNodeContents(elements.content);
    range.collapse(false);
  }
  setEditorCaret(range);
}

function restoreEditorSnapshot(snapshot) {
  state.restoringHistory = true;
  elements.content.innerHTML = snapshot.html;
  state.restoringHistory = false;
  elements.content.focus();
  restoreEditorSelection(snapshot.selection);
  updateEditorWordCount();
  scheduleSave();
}

function undoEditorChange() {
  const history = state.editorHistory;
  if (history.entryId !== state.selectedId || history.index <= 0) return false;
  history.index -= 1;
  restoreEditorSnapshot(history.states[history.index]);
  return true;
}

function redoEditorChange() {
  const history = state.editorHistory;
  if (history.entryId !== state.selectedId || history.index >= history.states.length - 1) return false;
  history.index += 1;
  restoreEditorSnapshot(history.states[history.index]);
  return true;
}

function editorOwnsFocus() {
  return document.activeElement === elements.content;
}

function notifyEditorChanged(inputType = "insertText") {
  let event;
  try {
    event = new InputEvent("input", { bubbles: true, inputType });
  } catch {
    event = new Event("input", { bubbles: true });
  }
  elements.content.dispatchEvent(event);
}

function executeEditorCommand(command, value, inputType) {
  if (typeof document.execCommand !== "function") return false;
  updateCurrentHistorySelection();
  state.forceHistoryCheckpoint = true;
  let inputFired = false;
  const markInput = () => {
    inputFired = true;
  };
  elements.content.addEventListener("input", markInput, { once: true });
  let succeeded = false;
  try {
    succeeded = document.execCommand(command, false, value);
  } catch {
    succeeded = false;
  }
  elements.content.removeEventListener("input", markInput);
  if (succeeded && !inputFired) notifyEditorChanged(inputType);
  if (!succeeded && !inputFired) state.forceHistoryCheckpoint = false;
  return succeeded || inputFired;
}

function insertTextAtCaret(text, inputType = "insertText") {
  if (!state.selectedId || (state.mediaEntryId && state.mediaEntryId !== state.selectedId)) return false;
  elements.content.focus();
  const range = editorInsertionRange();
  setEditorCaret(range);
  if (executeEditorCommand("insertText", String(text || ""), inputType)) {
    captureEditorRange();
    return true;
  }
  range.deleteContents();
  const node = document.createTextNode(String(text || ""));
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  setEditorCaret(range);
  notifyEditorChanged(inputType);
  return true;
}

function insertRichHtmlAtCaret(html, inputType = "insertFromPaste") {
  if (!state.selectedId || (state.mediaEntryId && state.mediaEntryId !== state.selectedId)) return false;
  const safeHtml = sanitizeRichContent(html);
  if (!safeHtml) return false;
  assertMediaBudget(dataImageCharacterCount(safeHtml));
  elements.content.focus();
  const range = editorInsertionRange();
  setEditorCaret(range);
  if (executeEditorCommand("insertHTML", safeHtml, inputType)) {
    captureEditorRange();
    return true;
  }

  range.deleteContents();
  const fragment = range.createContextualFragment(safeHtml);
  const lastNode = fragment.lastChild;
  range.insertNode(fragment);
  if (lastNode) range.setStartAfter(lastNode);
  range.collapse(true);
  setEditorCaret(range);
  notifyEditorChanged(inputType);
  return true;
}

function insertClipboardHtmlAtCaret(html, inputType = "insertFromPaste") {
  const safeHtml = sanitizeRichContent(html);
  if (!safeHtml) return false;
  const containsMedia = dataImageCharacterCount(safeHtml) > 0;
  const beforeInsertion = containsMedia ? editorSnapshot() : null;
  if (!insertRichHtmlAtCaret(safeHtml, inputType)) return false;
  if (!containsMedia) return true;

  if (flushSave()) {
    renderStats();
    renderCalendar();
    renderList();
    return true;
  }

  if (!undoEditorChange() && beforeInsertion) {
    restoreEditorSnapshot(beforeInsertion);
    resetEditorHistory();
  }
  const recovered = flushSave();
  if (recovered) {
    renderStats();
    renderCalendar();
    renderList();
    showToast("存储空间不足，剪贴板中的图片未插入");
  }
  return true;
}

function mediaMetadataAttributes(node, metadata = {}) {
  const attribution = String(metadata.attribution || "").slice(0, 600);
  if (attribution) {
    node.dataset.attribution = attribution;
    node.title = attribution;
  }
  const openverseId = String(metadata.openverseId || "").slice(0, 80);
  if (openverseId) node.dataset.openverseId = openverseId;
  [
    ["sourceUrl", "sourceUrl"],
    ["creatorUrl", "creatorUrl"],
    ["licenseUrl", "licenseUrl"],
  ].forEach(([key, datasetKey]) => {
    const url = isSafeWebUrl(metadata[key]);
    if (url) node.dataset[datasetKey] = url;
  });
}

function insertMediaDataUrl(dataUrl, kind, metadata = {}, targetRange = null) {
  if (!DATA_IMAGE_PATTERN.test(String(dataUrl || ""))) throw new Error("不支持的图片格式");
  assertMediaBudget(String(dataUrl).length);
  if (!state.selectedId || (state.mediaEntryId && state.mediaEntryId !== state.selectedId)) {
    throw new Error("日记已切换，请重新插入");
  }

  const mediaKind = kind === "sticker" ? "sticker" : "image";
  let image = document.createElement("img");
  image.src = dataUrl;
  image.className = mediaKind === "sticker" ? "inline-sticker" : "diary-image";
  image.dataset.mediaKind = mediaKind;
  image.alt = String(metadata.alt || (mediaKind === "sticker" ? "表情包" : "图片")).slice(0, 160);
  mediaMetadataAttributes(image, metadata);

  const insertionId = `media-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  image.dataset.dayleafInsertion = insertionId;
  const credit = mediaKind === "image" && metadata.attribution
    ? document.createElement("span")
    : null;
  if (credit) {
    credit.className = "media-credit";
    credit.contentEditable = "false";
    credit.textContent = String(metadata.attribution).slice(0, 600);
  }
  const lineBreak = mediaKind === "image" ? document.createElement("div") : null;
  lineBreak?.append(document.createElement("br"));

  const commandHtml = mediaKind === "sticker"
    ? `${image.outerHTML}&nbsp;`
    : `${image.outerHTML}${credit?.outerHTML || ""}${lineBreak.outerHTML}`;

  elements.content.focus();
  const range = rangeBelongsToEditor(targetRange) ? targetRange.cloneRange() : editorInsertionRange();
  setEditorCaret(range);
  const insertedWithCommand = executeEditorCommand("insertHTML", commandHtml, "insertHTML");
  if (insertedWithCommand) {
    const insertedImage = elements.content.querySelector(`[data-dayleaf-insertion="${insertionId}"]`);
    if (!insertedImage) throw new Error("图片插入后无法定位");
    image = insertedImage;
    image.removeAttribute("data-dayleaf-insertion");
    image.dayleafUndoableInsertion = true;
  } else {
    image.removeAttribute("data-dayleaf-insertion");
    range.deleteContents();
    range.insertNode(image);
    if (mediaKind === "sticker") {
      image.after(document.createTextNode("\u00a0"));
    } else {
      image.after(...[credit, lineBreak].filter(Boolean));
    }
    notifyEditorChanged("insertHTML");
  }

  let caretNode;
  if (mediaKind === "sticker") {
    caretNode = image.nextSibling || document.createTextNode("\u00a0");
    if (!caretNode.parentNode) image.after(caretNode);
    image.dayleafCompanionNodes = [caretNode];
  } else {
    const insertedCredit = metadata.attribution && image.nextElementSibling?.classList.contains("media-credit")
      ? image.nextElementSibling
      : null;
    const insertedLineBreak = insertedCredit?.nextElementSibling || image.nextElementSibling;
    caretNode = insertedLineBreak || lineBreak;
    image.dayleafCompanionNodes = [insertedCredit, insertedLineBreak].filter(Boolean);
  }

  const nextRange = document.createRange();
  if (caretNode.nodeType === Node.TEXT_NODE) {
    nextRange.setStartAfter(caretNode);
  } else {
    nextRange.selectNodeContents(caretNode);
    nextRange.collapse(true);
  }
  nextRange.collapse(true);
  setEditorCaret(nextRange);
  return image;
}

function rollbackMediaInsertion(image) {
  if (!image?.parentNode) return;
  if (image.dayleafUndoableInsertion && undoEditorChange()) return;
  const parent = image.parentNode;
  const offset = [...parent.childNodes].indexOf(image);
  (image.dayleafCompanionNodes || []).forEach((node) => node.remove());
  image.remove();
  const range = document.createRange();
  range.setStart(parent, Math.max(0, Math.min(offset, parent.childNodes.length)));
  range.collapse(true);
  setEditorCaret(range);
  notifyEditorChanged("historyUndo");
}

function commitMediaInsertion(image) {
  if (flushSave()) {
    renderStats();
    renderCalendar();
    renderList();
    return true;
  }
  rollbackMediaInsertion(image);
  const recovered = flushSave();
  if (recovered) {
    renderStats();
    renderCalendar();
    renderList();
    showToast("存储空间不足，这张素材未插入");
  }
  return false;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("无法读取图片"));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function loadImageBlob(blob) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("这张图片无法解析"));
    };
    image.src = objectUrl;
  });
}

async function prepareImageBlob(blob, kind = "image") {
  if (!(blob instanceof Blob) || !String(blob.type).startsWith("image/")) {
    throw new Error("请选择有效的图片文件");
  }
  if (blob.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("单张图片不能超过 20 MB");
  }

  const isSticker = kind === "sticker";
  const maxDimension = isSticker ? 320 : 1400;
  const targetBytes = isSticker ? 90 * 1024 : 320 * 1024;
  const preservedGifLimit = isSticker ? 120 * 1024 : 480 * 1024;
  const { image, objectUrl } = await loadImageBlob(blob);

  try {
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    if (!naturalWidth || !naturalHeight) throw new Error("这张图片尺寸无效");

    if (
      blob.type === "image/gif" &&
      blob.size <= preservedGifLimit &&
      Math.max(naturalWidth, naturalHeight) <= maxDimension
    ) {
      return blobToDataUrl(blob);
    }

    let sizeScale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));
    let quality = isSticker ? 0.8 : 0.82;
    let latestBlob = null;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(naturalWidth * sizeScale));
      canvas.height = Math.max(1, Math.round(naturalHeight * sizeScale));
      const context = canvas.getContext("2d", { alpha: true });
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      latestBlob = await canvasToBlob(canvas, "image/webp", quality);
      if (!latestBlob) latestBlob = await canvasToBlob(canvas, "image/jpeg", quality);
      if (!latestBlob) throw new Error("当前系统无法压缩这张图片");
      if (latestBlob.size <= targetBytes) return blobToDataUrl(latestBlob);

      if (quality > 0.58) {
        quality -= 0.1;
      } else {
        sizeScale *= 0.78;
        quality = 0.74;
      }
    }

    if (!latestBlob || latestBlob.size > targetBytes * 1.3) {
      throw new Error("图片压缩后仍然过大，请换一张尺寸更小的图片");
    }
    return blobToDataUrl(latestBlob);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function normalizeCustomStickers(saved) {
  if (!Array.isArray(saved)) return [];
  return saved
    .filter((sticker) => sticker && DATA_IMAGE_PATTERN.test(String(sticker.dataUrl || "")))
    .slice(0, MAX_CUSTOM_STICKERS)
    .map((sticker) => ({
      id: String(sticker.id || ""),
      name: String(sticker.name || "自定义表情包").slice(0, 80),
      dataUrl: String(sticker.dataUrl),
    }));
}

function customStickers() {
  return normalizeCustomStickers(journalStore.getPreference(CUSTOM_STICKERS_KEY, []));
}

function saveCustomStickers(stickers) {
  const nextStickers = stickers.slice(0, MAX_CUSTOM_STICKERS);
  assertMediaBudget(0, nextStickers);
  journalStore.setPreference(CUSTOM_STICKERS_KEY, nextStickers);
  renderCustomStickers();
}

function renderEmojiLibrary(query = "") {
  const term = String(query).trim().toLocaleLowerCase("zh-CN");
  const matches = emojiLibrary.filter(([emoji, keywords]) =>
    !term || `${emoji} ${keywords}`.toLocaleLowerCase("zh-CN").includes(term),
  );
  elements.emojiGrid.replaceChildren();
  matches.forEach(([emoji, keywords]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "emoji-button";
    button.dataset.emoji = emoji;
    button.title = keywords.split(" ").join("·");
    button.setAttribute("aria-label", `插入${keywords.split(" ")[0]}表情 ${emoji}`);
    button.textContent = emoji;
    elements.emojiGrid.append(button);
  });
}

function renderCustomStickers() {
  const stickers = customStickers();
  elements.customStickerGrid.replaceChildren();
  elements.customStickerEmpty.hidden = stickers.length > 0;
  stickers.forEach((sticker) => {
    const item = document.createElement("div");
    item.className = "custom-sticker-item";

    const insertButton = document.createElement("button");
    insertButton.type = "button";
    insertButton.className = "custom-sticker-insert";
    insertButton.dataset.customStickerId = sticker.id;
    insertButton.title = `插入 ${sticker.name}`;
    const image = document.createElement("img");
    image.src = sticker.dataUrl;
    image.alt = sticker.name;
    insertButton.append(image);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "custom-sticker-delete";
    deleteButton.dataset.deleteStickerId = sticker.id;
    deleteButton.setAttribute("aria-label", `移除 ${sticker.name}`);
    deleteButton.textContent = "×";
    item.append(insertButton, deleteButton);
    elements.customStickerGrid.append(item);
  });
}

function setMediaMode(mode) {
  const showStickers = mode !== "image";
  elements.stickerPanel.hidden = !showStickers;
  elements.imagePanel.hidden = showStickers;
  $("#sticker-tab").setAttribute("aria-selected", String(showStickers));
  $("#image-tab").setAttribute("aria-selected", String(!showStickers));
  elements.mediaDialogTitle.textContent = showStickers ? "插入表情" : "插入图片";
}

function openMediaDialog(mode) {
  if (!currentEntry()) return;
  captureEditorRange();
  state.mediaEntryId = state.selectedId;
  setMediaMode(mode);
  renderEmojiLibrary($("#emoji-search-input").value);
  renderCustomStickers();
  if (!elements.mediaDialog.open) elements.mediaDialog.showModal();
}

function beginMediaOperation() {
  state.mediaOperationController?.abort();
  const controller = new AbortController();
  state.mediaOperationController = controller;
  state.mediaOperationId += 1;
  return {
    id: state.mediaOperationId,
    entryId: state.mediaEntryId || state.selectedId,
    range: editorInsertionRange(),
    controller,
  };
}

function mediaOperationIsCurrent(operation) {
  return Boolean(
    operation &&
    operation.id === state.mediaOperationId &&
    operation.entryId === state.selectedId &&
    !operation.controller.signal.aborted &&
    rangeBelongsToEditor(operation.range)
  );
}

function cancelMediaOperation() {
  state.mediaOperationId += 1;
  state.mediaOperationController?.abort();
  state.mediaOperationController = null;
}

function finishMediaOperation(operation) {
  if (state.mediaOperationController === operation?.controller) {
    state.mediaOperationController = null;
  }
}

function closeMediaDialog({ returnFocus = true } = {}) {
  cancelMediaOperation();
  state.openverseControllers.sticker?.abort();
  state.openverseControllers.image?.abort();
  state.openverseControllers.sticker = null;
  state.openverseControllers.image = null;
  if (elements.mediaDialog.open) elements.mediaDialog.close();
  if (returnFocus && state.selectedId === state.mediaEntryId) {
    requestAnimationFrame(() => {
      elements.content.focus();
      if (rangeBelongsToEditor(state.editorRange)) setEditorCaret(state.editorRange);
    });
  }
}

function openverseAttribution(result) {
  const supplied = contentToText(result?.attribution || "", "html");
  const creator = String(result?.creator || "未知创作者").trim();
  const license = [result?.license, result?.license_version]
    .filter(Boolean)
    .join(" ")
    .toLocaleUpperCase();
  const fallback = `${String(result?.title || "开放素材").trim()} · ${creator}${license ? ` · ${license}` : ""}`;
  return `Openverse · ${supplied || fallback}`.slice(0, 600);
}

function openverseMetadata(result, kind) {
  const title = contentToText(result?.title || "", "html") || (kind === "sticker" ? "在线表情包" : "在线图片");
  return {
    alt: `${kind === "sticker" ? "表情包" : "图片"}：${title}`.slice(0, 160),
    attribution: openverseAttribution(result),
    openverseId: result?.id,
    sourceUrl: result?.foreign_landing_url,
    creatorUrl: result?.creator_url,
    licenseUrl: result?.license_url,
  };
}

function onlineElements(mode) {
  return mode === "sticker"
    ? { results: elements.stickerOnlineResults, status: elements.stickerOnlineStatus }
    : { results: elements.imageOnlineResults, status: elements.imageOnlineStatus };
}

async function fetchImageBlob(url, { signal, timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const forwardAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", forwardAbort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { Accept: "image/*" },
    });
    if (!response.ok) throw new Error(`图片下载失败（${response.status}）`);

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_SOURCE_IMAGE_BYTES) {
      throw new Error("单张图片不能超过 20 MB");
    }
    const contentType = String(response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLocaleLowerCase();
    if (!contentType.startsWith("image/")) throw new Error("返回内容不是图片");

    if (!response.body?.getReader) {
      const blob = await response.blob();
      if (blob.size > MAX_SOURCE_IMAGE_BYTES) throw new Error("单张图片不能超过 20 MB");
      return blob;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_SOURCE_IMAGE_BYTES) {
        await reader.cancel();
        throw new Error("单张图片不能超过 20 MB");
      }
      chunks.push(value);
    }
    return new Blob(chunks, { type: contentType });
  } catch (error) {
    if (timedOut) throw new Error("图片下载超时，请稍后再试");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", forwardAbort);
  }
}

function renderOpenverseResults(mode) {
  const target = onlineElements(mode).results;
  const results = state.openverseResults[mode];
  target.replaceChildren();
  results.forEach((result, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "online-result";
    button.dataset.openverseMode = mode;
    button.dataset.openverseIndex = String(index);
    button.title = `插入：${openverseAttribution(result)}`;

    const image = document.createElement("img");
    image.src = result.thumbnail;
    image.alt = contentToText(result.title || "在线素材", "html");
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";

    const copy = document.createElement("span");
    copy.className = "online-result-copy";
    const title = document.createElement("strong");
    title.textContent = image.alt || "无题素材";
    const credit = document.createElement("small");
    const license = [result.license, result.license_version].filter(Boolean).join(" ").toUpperCase();
    credit.textContent = `${result.creator || "未知创作者"}${license ? ` · ${license}` : ""}`;
    copy.append(title, credit);
    button.append(image, copy);
    target.append(button);
  });
}

async function searchOpenverse(mode) {
  const queryInput = mode === "sticker" ? $("#sticker-online-query") : $("#image-online-query");
  const query = queryInput.value.trim().slice(0, 200);
  const targets = onlineElements(mode);
  if (!query) {
    targets.status.textContent = "请先输入搜索词。";
    queryInput.focus();
    return;
  }

  state.openverseControllers[mode]?.abort();
  const controller = new AbortController();
  state.openverseControllers[mode] = controller;
  targets.status.textContent = "正在寻找开放授权素材…";
  targets.results.replaceChildren();

  const params = new URLSearchParams({
    q: query,
    page: "1",
    page_size: "12",
    mature: "false",
  });
  if (mode === "sticker") {
    params.set("category", "illustration");
    params.set("aspect_ratio", "square");
    params.set("license", "cc0,pdm");
  }

  try {
    const response = await fetch(`https://api.openverse.org/v1/images/?${params}`, {
      signal: controller.signal,
      mode: "cors",
      credentials: "omit",
      headers: { Accept: "application/json" },
    });
    if (response.status === 429) throw new Error("搜索太频繁，请稍后再试");
    if (!response.ok) throw new Error(`搜索暂时不可用（${response.status}）`);
    const payload = await response.json();
    state.openverseResults[mode] = (Array.isArray(payload.results) ? payload.results : [])
      .filter((result) => isSafeHttpsUrl(result?.thumbnail) && !result?.mature)
      .slice(0, 12);
    renderOpenverseResults(mode);
    targets.status.textContent = state.openverseResults[mode].length
      ? `找到 ${state.openverseResults[mode].length} 张，点击即可下载并插入。`
      : "没有找到合适素材，换个搜索词试试。";
  } catch (error) {
    if (error.name === "AbortError") return;
    state.openverseResults[mode] = [];
    targets.status.textContent = error.message || "无法连接在线图片库，请检查网络。";
  } finally {
    if (state.openverseControllers[mode] === controller) state.openverseControllers[mode] = null;
  }
}

async function insertOpenverseResult(mode, index, button) {
  const result = state.openverseResults[mode]?.[index];
  if (!result) return;
  const operation = beginMediaOperation();
  button.disabled = true;
  const status = onlineElements(mode).status;
  status.textContent = "正在下载并压缩素材…";

  try {
    const blob = await fetchImageBlob(result.thumbnail, { signal: operation.controller.signal });
    const dataUrl = await prepareImageBlob(blob, mode);
    if (!mediaOperationIsCurrent(operation)) return;
    const image = insertMediaDataUrl(
      dataUrl,
      mode,
      openverseMetadata(result, mode),
      operation.range,
    );
    if (!commitMediaInsertion(image)) {
      button.disabled = false;
      return;
    }
    closeMediaDialog();
    showToast(mode === "sticker" ? "在线表情包已插入" : "在线图片已插入");
  } catch (error) {
    if (error.name === "AbortError") return;
    status.textContent = error.message || "无法插入这张素材。";
    button.disabled = false;
  } finally {
    finishMediaOperation(operation);
  }
}

async function uploadCustomStickers(files) {
  const existing = customStickers();
  const remaining = MAX_CUSTOM_STICKERS - existing.length;
  if (remaining <= 0) {
    showToast(`个人表情包最多保存 ${MAX_CUSTOM_STICKERS} 个`);
    return;
  }

  const next = [...existing];
  let failed = 0;
  for (const file of [...files].slice(0, remaining)) {
    try {
      const dataUrl = await prepareImageBlob(file, "sticker");
      next.push({
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        name: String(file.name || "自定义表情包").replace(/\.[^.]+$/, "").slice(0, 80),
        dataUrl,
      });
    } catch {
      failed += 1;
    }
  }

  try {
    saveCustomStickers(next);
    const added = next.length - existing.length;
    showToast(failed ? `已添加 ${added} 个，${failed} 个无法读取` : `已添加 ${added} 个个人表情包`);
  } catch (error) {
    showStorageError(error);
  }
}

async function insertImageFiles(files) {
  const operation = beginMediaOperation();
  let inserted = 0;
  for (const file of [...files].slice(0, 4)) {
    try {
      const dataUrl = await prepareImageBlob(file, "image");
      if (!mediaOperationIsCurrent(operation)) {
        finishMediaOperation(operation);
        return;
      }
      const name = String(file.name || "本地图片").replace(/\.[^.]+$/, "");
      const image = insertMediaDataUrl(
        dataUrl,
        "image",
        { alt: `图片：${name}` },
        operation.range,
      );
      if (!commitMediaInsertion(image)) break;
      operation.range = state.editorRange.cloneRange();
      inserted += 1;
    } catch (error) {
      showToast(error.message || "有一张图片无法插入");
      break;
    }
  }
  finishMediaOperation(operation);
  if (inserted) {
    closeMediaDialog();
    showToast(`已插入 ${inserted} 张图片`);
  }
}

async function insertImageFromUrl() {
  const input = $("#image-url-input");
  const url = isSafeHttpsUrl(input.value.trim());
  if (!url) {
    showToast("请输入完整的 https 图片网址");
    input.focus();
    return;
  }
  const operation = beginMediaOperation();
  const button = $("#image-url-insert");
  button.disabled = true;
  try {
    const blob = await fetchImageBlob(url, { signal: operation.controller.signal });
    const dataUrl = await prepareImageBlob(blob, "image");
    if (!mediaOperationIsCurrent(operation)) return;
    const image = insertMediaDataUrl(
      dataUrl,
      "image",
      { alt: "图片：来自网址", sourceUrl: url },
      operation.range,
    );
    if (!commitMediaInsertion(image)) return;
    input.value = "";
    closeMediaDialog();
    showToast("网络图片已下载并插入");
  } catch (error) {
    if (error.name === "AbortError") return;
    showToast(error.message || "这个网站不允许下载图片，可先保存到本机再上传");
  } finally {
    finishMediaOperation(operation);
    button.disabled = false;
  }
}

function renderLayout() {
  if (state.view === "editor" && !currentEntry()) state.view = "list";
  const panelVisible = state.view !== "home";
  const editorVisible = state.view === "editor";
  elements.workspace.dataset.view = state.view;
  elements.journalPanel.toggleAttribute("inert", !panelVisible);
  elements.journalPanel.setAttribute("aria-hidden", String(!panelVisible));
  elements.editorPane.toggleAttribute("inert", !editorVisible);
  elements.editorPane.setAttribute("aria-hidden", String(!editorVisible));
  if (!panelVisible) elements.sidebar.classList.remove("mobile-open");

  const dashboardDate = parseDateKey(state.homeDate || toDateKey());
  const dashboardLabel = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(dashboardDate);
  elements.dashboardDateTitle.textContent = state.homeDate === toDateKey()
    ? `今天，${dashboardLabel}`
    : dashboardLabel;
  renderHomeWidgets();
  if (
    state.view === "home" &&
    state.homeWidgets.music &&
    !state.music.pollTimer &&
    !state.music.inFlight &&
    !["permission", "denied", "unavailable", "missing"].includes(state.music.phase)
  ) {
    refreshMusicStatus();
  } else if (state.view !== "home") {
    clearTimeout(state.music.pollTimer);
    state.music.pollTimer = null;
  }
}

function render() {
  renderLayout();
  renderStats();
  renderCalendar();
  renderList();
  renderEditor();
}

function renderStats() {
  const entries = journalStore.getAll();
  const totalWords = entries.reduce(
    (sum, entry) => sum + getWordCount(`${entry.title} ${entryBodyText(entry)}`),
    0,
  );
  elements.entryCount.textContent = entries.length;
  elements.streakCount.textContent = calculateStreak(entries);
  elements.wordCount.textContent = totalWords > 999 ? `${(totalWords / 1000).toFixed(1)}k` : totalWords;
  elements.allCount.textContent = entries.length;
  elements.favoriteCount.textContent = entries.filter((entry) => entry.favorite).length;
}

function renderCalendar() {
  const year = state.monthCursor.getFullYear();
  const month = state.monthCursor.getMonth();
  const selected = currentEntry();
  const selectedDate = state.view === "home"
    ? state.homeDate
    : (state.dateFilter || selected?.date || null);
  const entriesByDate = groupEntriesByDate(journalStore.getAll());
  const firstDay = new Date(year, month, 1);
  const leading = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const selectedDateValue = selectedDate ? parseDateKey(selectedDate) : null;
  const selectedDateInMonth = selectedDateValue &&
    selectedDateValue.getFullYear() === year &&
    selectedDateValue.getMonth() === month
    ? selectedDate
    : null;
  const today = new Date();
  const focusDate = selectedDateInMonth || (
    year === today.getFullYear() && month === today.getMonth()
      ? toDateKey(today)
      : toDateKey(firstDay)
  );

  elements.calendarTitle.textContent = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
  }).format(firstDay);

  const cells = [];
  for (let index = 0; index < 42; index += 1) {
    const day = index - leading + 1;
    if (day < 1 || day > daysInMonth) {
      cells.push("<span class=\"calendar-day empty\" aria-hidden=\"true\"></span>");
      continue;
    }
    const dateKey = toDateKey(new Date(year, month, day));
    const entryCount = entriesByDate.get(dateKey)?.length || 0;
    const classes = [
      "calendar-day",
      dateKey === toDateKey() ? "today" : "",
      entryCount ? "has-entry" : "",
      entryCount > 1 ? "has-multiple" : "",
      selectedDate === dateKey ? "selected" : "",
    ].filter(Boolean).join(" ");
    const countBadge = entryCount > 1
      ? `<span class="calendar-day-count" aria-hidden="true">${entryCount > 9 ? "9+" : entryCount}</span>`
      : "";
    const currentAttribute = dateKey === toDateKey() ? ' aria-current="date"' : "";
    const selectedAttribute = selectedDate === dateKey ? ' aria-pressed="true"' : ' aria-pressed="false"';
    cells.push(
      `<button class="${classes}" data-date="${dateKey}" tabindex="${focusDate === dateKey ? "0" : "-1"}"${currentAttribute}${selectedAttribute} aria-label="${dateKey}${entryCount ? `，${entryCount}篇日记` : "，没有日记"}"><span>${day}</span>${countBadge}</button>`,
    );
  }
  elements.calendarGrid.innerHTML = cells.join("");
}

function entryCard(entry) {
  const preview = entryBodyText(entry).trim().replace(/\s+/g, " ") || "还没有写下正文…";
  const entryTime = formatEntryTime(entry.createdAt);
  const tags = (entry.tags || [])
    .slice(0, 2)
    .map((tag) => `<span>#${escapeHtml(tag)}</span>`)
    .join("");
  return `
    <button class="entry-card ${entry.id === state.selectedId ? "selected" : ""}" data-entry-id="${escapeHtml(entry.id)}">
      <span class="entry-date">${escapeHtml(formatEntryDate(entry.date))}${entryTime ? ` · ${escapeHtml(entryTime)}` : ""}</span>
      <span class="entry-card-top">
        <strong>${escapeHtml(entry.title || "无题日记")}</strong>
        <span class="entry-mood" aria-label="${escapeHtml(entry.mood || "未设置心情")}">${MOODS[entry.mood] || "·"}</span>
      </span>
      <span class="entry-preview">${escapeHtml(preview)}</span>
      <span class="entry-meta">
        <span class="entry-tags">${tags}</span>
        ${entry.favorite ? "<span class=\"favorite-mark\">★</span>" : ""}
      </span>
    </button>
  `;
}

function renderList() {
  const entries = searchEntries(
    journalStore.getAll(),
    state.query,
    state.filter,
    state.dateFilter,
  );
  if (state.query) {
    elements.listTitle.textContent = `“${state.query}”的结果`;
  } else if (state.dateFilter) {
    const dateLabel = new Intl.DateTimeFormat("zh-CN", {
      month: "long",
      day: "numeric",
    }).format(parseDateKey(state.dateFilter));
    elements.listTitle.textContent = `${dateLabel} · ${entries.length}篇`;
  } else {
    elements.listTitle.textContent = state.filter === "favorite" ? "珍藏日记" : "所有日记";
  }
  elements.clearDateFilter.hidden = !state.dateFilter;
  elements.entryList.innerHTML = entries.map(entryCard).join("");
  elements.emptyList.hidden = entries.length > 0;
  elements.entryList.hidden = entries.length === 0;
}

function renderEditor() {
  cancelMediaOperation();
  const entry = currentEntry();
  elements.editorPlaceholder.hidden = Boolean(entry);
  elements.form.hidden = !entry;
  state.editorRange = null;
  state.editorEntryId = entry?.id || null;
  state.mediaEntryId = null;
  state.isDirty = false;
  state.saveFailed = false;
  if (!entry) {
    resetEditorHistory();
    return;
  }

  elements.date.value = entry.date;
  elements.title.value = entry.title;
  if (entry.contentFormat === "html") {
    elements.content.innerHTML = sanitizeRichContent(entry.content);
  } else {
    elements.content.textContent = entry.content;
  }
  elements.tags.value = entry.tags.join(", ");
  elements.favoriteButton.classList.toggle("active", entry.favorite);
  elements.favoriteButton.setAttribute("aria-pressed", String(entry.favorite));
  $$("#mood-picker button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mood === entry.mood);
  });
  updateEditorWordCount();
  resetEditorHistory();
}

function selectEntry(id, { focus = false } = {}) {
  if (!journalStore.get(id)) return;
  if (!flushSave()) return;
  state.openverseControllers.sticker?.abort();
  state.openverseControllers.image?.abort();
  state.selectedId = id;
  state.view = "editor";
  const entry = currentEntry();
  state.monthCursor = new Date(parseDateKey(entry.date).getFullYear(), parseDateKey(entry.date).getMonth(), 1);
  render();
  elements.sidebar.classList.remove("mobile-open");
  if (focus) requestAnimationFrame(() => elements.title.focus());
}

function goHome() {
  if (!flushSave()) return false;
  state.openverseControllers.sticker?.abort();
  state.openverseControllers.image?.abort();
  state.view = "home";
  state.selectedId = null;
  state.dateFilter = null;
  state.filter = "all";
  state.query = "";
  state.homeDate = toDateKey();
  if (!elements.promptAnswer.value.trim()) state.promptDate = state.homeDate;
  state.monthCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  elements.search.value = "";
  syncFilterButtons();
  render();
  updatePromptControls();
  return true;
}

function syncFilterButtons() {
  $$(".filter-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.filter === state.filter && !state.dateFilter);
  });
}

function showDate(date) {
  if (!flushSave()) return;
  state.openverseControllers.sticker?.abort();
  state.openverseControllers.image?.abort();
  state.dateFilter = date;
  state.homeDate = date;
  state.filter = "all";
  state.query = "";
  elements.search.value = "";
  syncFilterButtons();

  state.selectedId = null;
  state.view = "list";
  if (!elements.promptAnswer.value.trim()) state.promptDate = date;
  state.monthCursor = new Date(
    parseDateKey(date).getFullYear(),
    parseDateKey(date).getMonth(),
    1,
  );
  render();
  updatePromptControls();
  elements.sidebar.classList.remove("mobile-open");
}

function createEntry(date = state.dateFilter || toDateKey()) {
  if (!flushSave()) return null;
  let entry;
  try {
    entry = journalStore.create({ date });
  } catch (error) {
    showStorageError(error);
    return null;
  }
  const dayCount = journalStore.getAll().filter((item) => item.date === date).length;
  state.selectedId = entry.id;
  state.view = "editor";
  state.query = "";
  state.filter = "all";
  state.dateFilter = date;
  state.homeDate = date;
  elements.search.value = "";
  syncFilterButtons();
  state.monthCursor = new Date(parseDateKey(date).getFullYear(), parseDateKey(date).getMonth(), 1);
  render();
  requestAnimationFrame(() => elements.title.focus());
  showToast(dayCount > 1 ? `这一天的第 ${dayCount} 篇日记已准备好` : "新日记已准备好");
  return entry;
}

function createPromptEntry() {
  const answer = elements.promptAnswer.value.trim();
  if (!answer) {
    elements.promptAnswer.focus();
    return null;
  }
  if (!flushAll()) {
    showToast("回答草稿还没有保存，请稍后再试");
    return null;
  }

  const date = state.promptDate || promptTargetDate();
  const title = state.promptText.replace(/[？?。！!]+$/g, "").slice(0, 28) || "今日一问";
  let entry;
  try {
    entry = journalStore.create({
      date,
      title,
      content: `${state.promptText}\n\n${answer}`,
      contentFormat: "text",
      tags: ["写作提示"],
    });
  } catch (error) {
    showStorageError(error);
    return null;
  }

  clearPromptDraft();
  state.selectedId = entry.id;
  state.view = "editor";
  state.query = "";
  state.filter = "all";
  state.dateFilter = date;
  state.homeDate = date;
  elements.search.value = "";
  syncFilterButtons();
  state.monthCursor = new Date(parseDateKey(date).getFullYear(), parseDateKey(date).getMonth(), 1);
  render();
  requestAnimationFrame(() => {
    const range = document.createRange();
    range.selectNodeContents(elements.content);
    range.collapse(false);
    elements.content.focus();
    setEditorCaret(range);
  });
  showToast("回答已经写进日记");
  return entry;
}

function collectFormData() {
  return {
    date: elements.date.value || toDateKey(),
    title: elements.title.value,
    content: sanitizeRichContent(elements.content.innerHTML),
    contentFormat: "html",
    tags: normalizeTags(elements.tags.value),
  };
}

function persistForm() {
  const entry = currentEntry();
  if (!entry) return null;
  if (state.forceNextSaveFailure) {
    state.forceNextSaveFailure = false;
    throw new DOMException("模拟的存储配额错误", "QuotaExceededError");
  }
  const updated = journalStore.update(entry.id, collectFormData());
  if (updated && state.dateFilter === entry.date && updated.date !== entry.date) {
    state.dateFilter = updated.date;
  }
  return updated;
}

function scheduleSave() {
  if (!state.selectedId) return;
  state.isDirty = true;
  state.saveFailed = false;
  setSaveState("正在保存…", true);
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    try {
      persistForm();
      state.saveTimer = null;
      state.isDirty = false;
      state.saveFailed = false;
      setSaveState("已保存");
      renderStats();
      renderCalendar();
      renderList();
    } catch (error) {
      handleSaveError(error);
    }
  }, 500);
}

function flushSave() {
  if (!state.selectedId || !state.isDirty) return true;
  if (state.saveTimer) clearTimeout(state.saveTimer);
  try {
    persistForm();
    state.saveTimer = null;
    state.isDirty = false;
    state.saveFailed = false;
    setSaveState("已保存");
    return true;
  } catch (error) {
    handleSaveError(error);
    return false;
  }
}

function updateEditorWordCount() {
  const count = getWordCount(`${elements.title.value} ${contentToText(elements.content.innerHTML, "html")}`);
  elements.editorWordCount.textContent = `${count} 字`;
}

function moveMonth(amount) {
  state.monthCursor = new Date(
    state.monthCursor.getFullYear(),
    state.monthCursor.getMonth() + amount,
    1,
  );
  renderCalendar();
}

function focusCalendarDate(date) {
  const parsed = parseDateKey(date);
  const monthChanged =
    parsed.getFullYear() !== state.monthCursor.getFullYear() ||
    parsed.getMonth() !== state.monthCursor.getMonth();
  if (monthChanged) {
    state.monthCursor = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    renderCalendar();
  }
  requestAnimationFrame(() => {
    const target = elements.calendarGrid.querySelector(`[data-date="${date}"]`);
    if (!target) return;
    elements.calendarGrid.querySelectorAll("[data-date]").forEach((button) => {
      button.tabIndex = button === target ? 0 : -1;
    });
    target.focus();
  });
}

function handleCalendarKeydown(event) {
  const button = event.target.closest?.("[data-date]");
  if (!button) return;
  const current = parseDateKey(button.dataset.date);
  let target = null;
  if (event.key === "ArrowLeft") target = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 1);
  if (event.key === "ArrowRight") target = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
  if (event.key === "ArrowUp") target = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7);
  if (event.key === "ArrowDown") target = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7);
  if (event.key === "Home") {
    const offset = (current.getDay() + 6) % 7;
    target = new Date(current.getFullYear(), current.getMonth(), current.getDate() - offset);
  }
  if (event.key === "End") {
    const offset = 6 - ((current.getDay() + 6) % 7);
    target = new Date(current.getFullYear(), current.getMonth(), current.getDate() + offset);
  }
  if (["PageUp", "PageDown"].includes(event.key)) {
    const direction = event.key === "PageUp" ? -1 : 1;
    const targetMonth = new Date(current.getFullYear(), current.getMonth() + direction, 1);
    const targetDay = Math.min(
      current.getDate(),
      new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate(),
    );
    target = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), targetDay);
  }
  if (!target) return;
  event.preventDefault();
  focusCalendarDate(toDateKey(target));
}

function downloadFile(name, content, type) {
  const nativeSaver = window.webkit?.messageHandlers?.dayleafSaveFile;
  if (nativeSaver) {
    nativeSaver.postMessage({ name, content, type });
    return;
  }

  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  if (!flushSave()) return;
  const payload = {
    app: "Dayleaf",
    version: 2,
    exportedAt: new Date().toISOString(),
    entries: journalStore.getAll(),
    preferences: {
      customStickers: customStickers(),
    },
  };
  downloadFile(
    `dayleaf-backup-${toDateKey()}.json`,
    JSON.stringify(payload, null, 2),
    "application/json",
  );
  showToast("完整备份已导出");
}

function exportMarkdown() {
  if (!flushSave()) return;
  const markdown = journalStore
    .getAll()
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
    .map((entry) => {
      const tags = entry.tags.length ? `\n标签：${entry.tags.map((tag) => `#${tag}`).join(" ")}` : "";
      const mood = entry.mood ? `\n心情：${MOODS[entry.mood]} ${entry.mood}` : "";
      return `# ${entry.title || "无题日记"}\n\n日期：${entry.date}${mood}${tags}\n\n${entryBodyText(entry)}`;
    })
    .join("\n\n---\n\n");
  downloadFile(`dayleaf-${toDateKey()}.md`, markdown || "# 我的日叶\n", "text/markdown");
  showToast("Markdown 已导出");
}

async function importBackup(file) {
  try {
    if (!flushSave()) return;
    const payload = JSON.parse(await file.text());
    if (payload.app !== "Dayleaf" || !Array.isArray(payload.entries)) {
      throw new Error("invalid backup");
    }
    const preferenceUpdates = Array.isArray(payload.preferences?.customStickers)
      ? { customStickers: normalizeCustomStickers(payload.preferences.customStickers) }
      : {};
    journalStore.replaceAllWithPreferences(
      sanitizeImportedEntries(payload.entries),
      preferenceUpdates,
    );
    renderCustomStickers();
    state.selectedId = null;
    state.view = "home";
    state.homeDate = toDateKey();
    state.dateFilter = null;
    state.filter = "all";
    state.query = "";
    elements.search.value = "";
    syncFilterButtons();
    render();
    elements.backupDialog.close();
    showToast(`已恢复 ${payload.entries.length} 篇日记`);
  } catch (error) {
    if (isStorageError(error)) showStorageError(error);
    else showToast("无法读取这个备份文件");
  } finally {
    elements.importInput.value = "";
  }
}

function importNativeBackup(backupText) {
  const payload = JSON.parse(backupText);
  if (payload.app !== "Dayleaf" || !Array.isArray(payload.entries)) {
    throw new Error("invalid backup");
  }

  const sanitizedIncomingEntries = sanitizeImportedEntries(payload.entries);
  const allById = new Map(journalStore.getAll().map((entry) => [entry.id, entry]));
  for (const incomingEntry of sanitizedIncomingEntries) {
    const existingEntry = allById.get(incomingEntry.id);
    const existingUpdatedAt = Date.parse(existingEntry?.updatedAt || "") || 0;
    const incomingUpdatedAt = Date.parse(incomingEntry.updatedAt || "") || 0;
    if (!existingEntry || incomingUpdatedAt >= existingUpdatedAt) {
      allById.set(incomingEntry.id, incomingEntry);
    }
  }

  let preferenceUpdates = {};
  if (Array.isArray(payload.preferences?.customStickers)) {
    const mergedStickers = new Map(customStickers().map((sticker) => [sticker.id || sticker.dataUrl, sticker]));
    normalizeCustomStickers(payload.preferences.customStickers).forEach((sticker) => {
      mergedStickers.set(sticker.id || sticker.dataUrl, sticker);
    });
    preferenceUpdates = {
      customStickers: [...mergedStickers.values()].slice(0, MAX_CUSTOM_STICKERS),
    };
  }
  journalStore.replaceAllWithPreferences([...allById.values()], preferenceUpdates);
  const allEntries = journalStore.getAll();
  const latestIncoming = [...sanitizedIncomingEntries].sort((a, b) =>
    String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
  )[0];
  const importedLatest = latestIncoming
    ? allEntries.find((entry) => entry.id === String(latestIncoming.id))
    : null;

  state.selectedId = null;
  state.view = "home";
  state.homeDate = toDateKey();
  state.dateFilter = null;
  state.filter = "all";
  state.query = "";
  elements.search.value = "";
  syncFilterButtons();
  render();

  return JSON.stringify({
    importedCount: payload.entries.length,
    totalCount: allEntries.length,
    latestEntryMatches:
      !latestIncoming ||
      (importedLatest?.title === String(latestIncoming.title || "").slice(0, 100) &&
        importedLatest?.content === String(latestIncoming.content || "")),
  });
}

function verifyNativeBackup(backupText) {
  const payload = JSON.parse(backupText);
  if (payload.app !== "Dayleaf" || !Array.isArray(payload.entries)) {
    throw new Error("invalid backup");
  }

  const allEntries = journalStore.getAll();
  return JSON.stringify({
    expectedCount: payload.entries.length,
    totalCount: allEntries.length,
    allEntriesMatch: payload.entries.every((incomingEntry) => {
      const storedEntry = allEntries.find((entry) => entry.id === String(incomingEntry.id));
      return (
        storedEntry?.date === incomingEntry.date &&
        storedEntry?.title === String(incomingEntry.title || "").slice(0, 100) &&
        storedEntry?.content === String(incomingEntry.content || "")
      );
    }),
  });
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    journalStore.setPreference("theme", theme);
  } catch {
    // The visual change still applies for this session when local storage is full.
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  meta.content = theme === "dark" ? "#1e211d" : "#f4f0e7";
}

function initializeTheme() {
  const saved = journalStore.getPreference("theme");
  const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(saved || preferred);
}

function platformName() {
  return navigator.userAgentData?.platform || navigator.platform || "";
}

function initializeShortcutHints() {
  const modifier = shortcutModifierLabel(platformName());
  elements.searchShortcutLabel.textContent = `${modifier} K`;
  $("#new-entry-button").title = `写日记 (${modifier} N)`;
  elements.content.dataset.shortcutModifier = modifier;
}

function focusDiarySearch() {
  if (splashState.phase !== "hidden" || $("dialog[open]")) return false;
  if (!flushSave()) return false;
  state.view = "list";
  state.selectedId = null;
  state.dateFilter = null;
  syncFilterButtons();
  render();
  elements.search.focus();
  elements.search.select();
  return true;
}

function saveCurrentEntry() {
  const hadEntry = Boolean(currentEntry());
  if (!flushAll()) return false;
  renderStats();
  renderCalendar();
  renderList();
  showToast(hadEntry ? "日记已保存" : "草稿已保存");
  return true;
}

function bindEvents() {
  $("#new-entry-button").addEventListener("click", () => createEntry());
  $("#empty-new-button").addEventListener("click", () => createEntry(state.dateFilter || toDateKey()));
  $("#brand-button").addEventListener("click", goHome);
  elements.promptAnswer.addEventListener("input", schedulePromptDraftSave);
  elements.promptShuffleButton.addEventListener("click", chooseWritingPrompt);
  elements.promptWriteButton.addEventListener("click", createPromptEntry);
  elements.widgetSettingsButton.addEventListener("click", () => {
    renderWidgetSettings();
    elements.widgetSettingsDialog.showModal();
    requestAnimationFrame(() => $("#widget-settings-title")?.focus());
  });
  elements.widgetSettingsDialog.addEventListener("close", () => elements.widgetSettingsButton.focus());
  $$('[name="music-provider"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      if (selectMusicProvider(input.value)) {
        showToast(`已选择${selectedMusicProvider().name}`);
      } else {
        renderWidgetSettings();
      }
    });
  });
  $$('[data-widget-enable]').forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.widgetEnable;
      const enabled = await enableHomeWidget(id);
      if (enabled && elements.widgetSettingsDialog.open) {
        elements.widgetSettingsDialog.querySelector(`[data-widget-disable="${id}"]`)?.focus();
      }
    });
  });
  $$('[data-widget-disable]').forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.widgetDisable;
      const disabled = disableHomeWidget(id);
      if (disabled && elements.widgetSettingsDialog.open) {
        elements.widgetSettingsDialog.querySelector(`[data-widget-enable="${id}"]`)?.focus();
      }
    });
  });
  elements.reflectionOpenButton.addEventListener("click", () => {
    const latestReflectionDate = [...state.reflectionDates].sort().at(-1);
    if (latestReflectionDate) showDate(latestReflectionDate);
  });
  elements.musicOpenButton.addEventListener("click", () => {
    if (["permission", "denied"].includes(state.music.phase)) authorizeMusicWidget();
    else performMusicAction("openApp");
  });
  elements.musicPlayButton.addEventListener("click", () => performMusicAction("playPause"));
  elements.musicNextButton.addEventListener("click", () => performMusicAction("next"));
  elements.breathingToggleButton.addEventListener("click", toggleBreathingTimer);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(state.music.pollTimer);
      state.music.pollTimer = null;
    } else if (state.view === "home" && state.homeWidgets.music) {
      refreshMusicStatus();
    }
  });
  elements.clearDateFilter.addEventListener("click", () => {
    if (!flushSave()) return;
    state.dateFilter = null;
    state.selectedId = null;
    state.view = "list";
    syncFilterButtons();
    render();
  });
  $("#previous-month").addEventListener("click", () => moveMonth(-1));
  $("#next-month").addEventListener("click", () => moveMonth(1));
  $("#mobile-menu-button").addEventListener("click", () => elements.sidebar.classList.toggle("mobile-open"));
  $("#mobile-back-button").addEventListener("click", () => {
    if (!flushSave()) return;
    state.selectedId = null;
    state.view = "list";
    render();
  });

  elements.search.addEventListener("input", (event) => {
    if (!flushSave()) {
      event.target.value = state.query;
      return;
    }
    state.dateFilter = null;
    state.query = event.target.value;
    state.selectedId = null;
    state.view = "list";
    syncFilterButtons();
    render();
  });

  elements.entryList.addEventListener("click", (event) => {
    const card = event.target.closest("[data-entry-id]");
    if (card) selectEntry(card.dataset.entryId);
  });

  elements.calendarGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-date]");
    if (!button) return;
    showDate(button.dataset.date);
  });
  elements.calendarGrid.addEventListener("keydown", handleCalendarKeydown);

  $$(".filter-item").forEach((button) => {
    button.addEventListener("click", () => {
      if (!flushSave()) return;
      state.filter = button.dataset.filter;
      state.dateFilter = null;
      state.selectedId = null;
      state.view = "list";
      syncFilterButtons();
      render();
    });
  });

  [elements.date, elements.title, elements.tags].forEach((input) => {
    input.addEventListener("input", () => {
      updateEditorWordCount();
      scheduleSave();
    });
  });
  elements.content.addEventListener("input", (event) => {
    recordEditorHistory(event);
    updateEditorWordCount();
    scheduleSave();
  });

  elements.form.addEventListener("submit", (event) => event.preventDefault());
  ["focus", "keyup", "mouseup", "input"].forEach((eventName) => {
    elements.content.addEventListener(eventName, captureEditorRange);
  });
  elements.content.addEventListener("click", (event) => {
    const image = event.target.closest?.("img[data-media-kind]");
    if (!image || !elements.content.contains(image)) return;
    selectMediaGroup(image);
  });
  elements.content.addEventListener("keydown", (event) => {
    if (isUndoShortcut(event)) {
      event.preventDefault();
      undoEditorChange();
      return;
    }
    if (isRedoShortcut(event)) {
      event.preventDefault();
      redoEditorChange();
      return;
    }
    if (!["Backspace", "Delete"].includes(event.key)) return;
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (
      range.collapsed ||
      range.startContainer !== range.endContainer ||
      range.endOffset - range.startOffset !== 1
    ) return;
    const selectedNode = range.startContainer.childNodes[range.startOffset];
    if (!(selectedNode instanceof HTMLImageElement) || !selectedNode.dataset.mediaKind) return;
    event.preventDefault();
    const parent = selectedNode.parentNode;
    const offset = range.startOffset;
    const credit = selectedNode.nextElementSibling?.classList.contains("media-credit")
      ? selectedNode.nextElementSibling
      : null;
    const deleteRange = document.createRange();
    deleteRange.setStartBefore(selectedNode);
    deleteRange.setEndAfter(credit || selectedNode);
    setEditorCaret(deleteRange);
    if (executeEditorCommand("delete", null, "deleteContent")) {
      captureEditorRange();
      return;
    }
    credit?.remove();
    selectedNode.remove();
    const nextRange = document.createRange();
    nextRange.setStart(parent, Math.min(offset, parent.childNodes.length));
    nextRange.collapse(true);
    setEditorCaret(nextRange);
    notifyEditorChanged("deleteContent");
  });
  document.addEventListener("selectionchange", () => {
    if (document.activeElement === elements.content) captureEditorRange();
  });

  [$("#sticker-button"), $("#image-button")].forEach((button) => {
    button.addEventListener("pointerdown", captureEditorRange);
  });
  $("#sticker-button").addEventListener("click", () => openMediaDialog("sticker"));
  $("#image-button").addEventListener("click", () => openMediaDialog("image"));
  $("#media-close-button").addEventListener("click", () => closeMediaDialog());
  $("#sticker-tab").addEventListener("click", () => setMediaMode("sticker"));
  $("#image-tab").addEventListener("click", () => setMediaMode("image"));
  elements.mediaDialog.addEventListener("click", (event) => {
    if (event.target === elements.mediaDialog) closeMediaDialog();
  });
  elements.mediaDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeMediaDialog();
  });

  $("#emoji-search-input").addEventListener("input", (event) => renderEmojiLibrary(event.target.value));
  elements.emojiGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-emoji]");
    if (!button) return;
    insertTextAtCaret(button.dataset.emoji);
    closeMediaDialog();
  });

  elements.stickerUploadInput.addEventListener("change", async (event) => {
    await uploadCustomStickers(event.target.files || []);
    event.target.value = "";
  });
  elements.customStickerGrid.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-sticker-id]");
    if (deleteButton) {
      try {
        saveCustomStickers(customStickers().filter((sticker) => sticker.id !== deleteButton.dataset.deleteStickerId));
        showToast("已移除这个表情包");
      } catch (error) {
        showStorageError(error);
      }
      return;
    }

    const insertButton = event.target.closest("[data-custom-sticker-id]");
    if (!insertButton) return;
    const sticker = customStickers().find((item) => item.id === insertButton.dataset.customStickerId);
    if (!sticker) return;
    try {
      const image = insertMediaDataUrl(sticker.dataUrl, "sticker", { alt: `表情包：${sticker.name}` });
      if (!commitMediaInsertion(image)) return;
      closeMediaDialog();
    } catch (error) {
      showStorageError(error);
    }
  });

  elements.imageUploadInput.addEventListener("change", async (event) => {
    await insertImageFiles(event.target.files || []);
    event.target.value = "";
  });
  $("#image-url-insert").addEventListener("click", insertImageFromUrl);
  $("#image-url-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      insertImageFromUrl();
    }
  });

  $("#sticker-online-search").addEventListener("click", () => searchOpenverse("sticker"));
  $("#image-online-search").addEventListener("click", () => searchOpenverse("image"));
  [
    [$("#sticker-online-query"), "sticker"],
    [$("#image-online-query"), "image"],
  ].forEach(([input, mode]) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        searchOpenverse(mode);
      }
    });
  });
  [elements.stickerOnlineResults, elements.imageOnlineResults].forEach((container) => {
    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-openverse-index]");
      if (!button) return;
      insertOpenverseResult(
        button.dataset.openverseMode,
        Number(button.dataset.openverseIndex),
        button,
      );
    });
  });

  elements.content.addEventListener("paste", (event) => {
    const imageFiles = [...(event.clipboardData?.files || [])]
      .filter((file) => file.type.startsWith("image/"));
    state.mediaEntryId = state.selectedId;
    captureEditorRange();
    if (imageFiles.length) {
      event.preventDefault();
      insertImageFiles(imageFiles);
      return;
    }

    const plainText = event.clipboardData?.getData("text/plain") || "";
    const richText = event.clipboardData?.getData("text/html") || "";
    if (plainText || richText) {
      event.preventDefault();
      try {
        if (richText && insertClipboardHtmlAtCaret(richText)) return;
        insertTextAtCaret(plainText || contentToText(richText, "html"), "insertFromPaste");
      } catch (error) {
        showStorageError(error);
      }
    }
  });
  elements.content.addEventListener("dragover", (event) => {
    if (
      [...(event.dataTransfer?.items || [])].some((item) => item.type.startsWith("image/")) ||
      [...(event.dataTransfer?.types || [])].some((type) => ["text/plain", "text/html"].includes(type))
    ) {
      event.preventDefault();
    }
  });
  elements.content.addEventListener("drop", (event) => {
    const imageFiles = [...(event.dataTransfer?.files || [])]
      .filter((file) => file.type.startsWith("image/"));
    const plainText = event.dataTransfer?.getData("text/plain") || "";
    const richText = event.dataTransfer?.getData("text/html") || "";
    if (!imageFiles.length && !plainText && !richText) return;
    event.preventDefault();
    const dropRange = document.caretRangeFromPoint?.(event.clientX, event.clientY);
    if (dropRange) {
      state.editorRange = dropRange.cloneRange();
      state.editorEntryId = state.selectedId;
    } else {
      captureEditorRange();
    }
    state.mediaEntryId = state.selectedId;
    if (imageFiles.length) {
      insertImageFiles(imageFiles);
    } else {
      try {
        if (richText && insertClipboardHtmlAtCaret(richText, "insertFromDrop")) return;
        insertTextAtCaret(plainText || contentToText(richText, "html"), "insertFromDrop");
      } catch (error) {
        showStorageError(error);
      }
    }
  });

  elements.moodPicker.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mood]");
    if (!button || !state.selectedId) return;
    if (!flushSave()) return;
    const entry = currentEntry();
    try {
      journalStore.update(state.selectedId, { mood: entry.mood === button.dataset.mood ? "" : button.dataset.mood });
      render();
    } catch (error) {
      showStorageError(error);
    }
  });

  elements.favoriteButton.addEventListener("click", () => {
    if (!flushSave()) return;
    const entry = currentEntry();
    if (!entry) return;
    try {
      journalStore.update(entry.id, { favorite: !entry.favorite });
      render();
      showToast(entry.favorite ? "已取消珍藏" : "已加入珍藏");
    } catch (error) {
      showStorageError(error);
    }
  });

  $("#delete-button").addEventListener("click", () => elements.deleteDialog.showModal());
  $("#confirm-delete-button").addEventListener("click", (event) => {
    const id = state.selectedId;
    if (!id) return;
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
    try {
      journalStore.delete(id);
    } catch (error) {
      event.preventDefault();
      handleSaveError(error);
      return;
    }
    state.isDirty = false;
    state.saveFailed = false;
    state.selectedId = null;
    state.view = "list";
    render();
    showToast("日记已删除");
  });

  $("#backup-button").addEventListener("click", () => elements.backupDialog.showModal());
  $("#export-json-button").addEventListener("click", exportJson);
  $("#export-markdown-button").addEventListener("click", exportMarkdown);
  elements.importInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) importBackup(file);
  });

  $("#theme-button").addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });

  document.addEventListener("keydown", (event) => {
    if (splashState.phase !== "hidden") return;
    if (isPrimaryShortcut(event, "s")) {
      event.preventDefault();
      saveCurrentEntry();
      return;
    }
    if ($("dialog[open]")) return;
    if (event.key === "Escape" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (state.view === "editor") {
        if (!flushSave()) return;
        event.preventDefault();
        state.selectedId = null;
        state.view = "list";
        render();
        requestAnimationFrame(() => elements.listTitle.focus?.());
        return;
      }
      if (state.view === "list") {
        event.preventDefault();
        if (goHome()) requestAnimationFrame(() => $("#brand-button").focus());
        return;
      }
    }
    if (isPrimaryShortcut(event, "k") || isPrimaryShortcut(event, "f")) {
      event.preventDefault();
      focusDiarySearch();
      return;
    }
    if (isPrimaryShortcut(event, "n")) {
      event.preventDefault();
      createEntry();
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (flushAll()) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

function initialize() {
  initializeTheme();
  prepareSplash();
  initializeShortcutHints();
  initializeWritingPrompt();
  initializeHomeWidgets();
  bindEvents();
  state.view = "home";
  state.selectedId = null;
  state.dateFilter = null;
  state.homeDate = toDateKey();
  render();
  splashState.appReady = true;

  const isNativeApp = document.documentElement.classList.contains("native-app");
  startSplashClock();
  if (!isNativeApp && "serviceWorker" in navigator && location.protocol !== "file:") {
    const isLocalDevelopment = ["localhost", "127.0.0.1"].includes(location.hostname);
    window.addEventListener("load", () => {
      if (isLocalDevelopment) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
        });
        return;
      }
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
}

window.dayleafNativePrepareToClose = flushAll;
window.dayleafNativeImportBackup = importNativeBackup;
window.dayleafNativeVerifyBackup = verifyNativeBackup;
window.dayleafNativeDidShow = startSplashClock;
window.dayleafForceFinishSplash = finishSplash;
window.dayleafCommands = {
  focusSearch: focusDiarySearch,
  newEntry: () => splashState.phase === "hidden" && Boolean(createEntry()),
  redo: () => editorOwnsFocus() && redoEditorChange(),
  save: saveCurrentEntry,
  undo: () => editorOwnsFocus() && undoEditorChange(),
};
window.dayleafTesting = {
  getDashboardState() {
    return {
      view: state.view,
      selectedId: state.selectedId,
      dateFilter: state.dateFilter,
      prompt: state.promptText,
      promptIndex: state.promptIndex,
      promptCount: WRITING_PROMPTS.length,
      promptDraft: elements.promptAnswer.value,
      journalPanelInert: elements.journalPanel.hasAttribute("inert"),
      editorInert: elements.editorPane.hasAttribute("inert"),
      entryCount: journalStore.getAll().length,
      homeWidgets: { ...state.homeWidgets },
      widgetLayout: elements.workspace.dataset.widgetLayout,
      widgetStartVisible: !elements.homeWidgetStart.hidden,
      widgetEndVisible: !elements.homeWidgetEnd.hidden,
      music: {
        provider: state.music.provider,
        mode: state.music.mode,
        capabilities: { ...state.music.capabilities },
        phase: state.music.phase,
        running: state.music.running,
        playing: state.music.playing,
        title: state.music.title,
        playButtonHidden: elements.musicPlayButton.hidden,
        nextButtonHidden: elements.musicNextButton.hidden,
      },
      breathing: {
        running: state.breathing.running,
        remainingMs: breathingRemainingMs(),
      },
    };
  },
  getSplashState,
  getShortcutProfile() {
    return {
      modifier: shortcutModifierLabel(platformName()),
      platform: platformName(),
    };
  },
  sanitizeRichContent,
  failNextSave() {
    state.forceNextSaveFailure = true;
  },
  async setHomeWidget(id, enabled) {
    return enabled ? enableHomeWidget(id) : disableHomeWidget(id);
  },
  setMusicProvider(provider) {
    return selectMusicProvider(provider);
  },
  async performMusicAction(action) {
    await performMusicAction(action);
    return state.music.phase;
  },
  async refreshMusic() {
    await refreshMusicStatus({ schedule: false, allowHidden: true });
    return state.music.phase;
  },
  toggleBreathing() {
    toggleBreathingTimer();
    return state.breathing.running;
  },
  async getNativeWidgetSmokeState() {
    return requestNativeWidget("testing", "state");
  },
  openDate(date) {
    showDate(date);
    return state.view;
  },
  submitPromptAnswer(answer) {
    elements.promptAnswer.value = String(answer || "").slice(0, 800);
    elements.promptAnswer.dispatchEvent(new Event("input", { bubbles: true }));
    return Boolean(createPromptEntry());
  },
  insertEmoji(emoji) {
    state.mediaEntryId = state.selectedId;
    return insertTextAtCaret(emoji);
  },
  pasteRichContent(html) {
    state.mediaEntryId = state.selectedId;
    captureEditorRange();
    return insertClipboardHtmlAtCaret(html);
  },
  insertMediaDataUrl(dataUrl, kind = "image", metadata = {}) {
    state.mediaEntryId = state.selectedId;
    return Boolean(insertMediaDataUrl(dataUrl, kind, metadata));
  },
};
initialize();
