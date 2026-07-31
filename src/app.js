import { journalStore } from "./store.js";
import {
  MOODS,
  calculateStreak,
  contentToText,
  escapeHtml,
  formatEntryDate,
  formatEntryTime,
  getWordCount,
  groupEntriesByDate,
  normalizeTags,
  parseDateKey,
  searchEntries,
  toDateKey,
} from "./utils.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  search: $("#search-input"),
  entryList: $("#entry-list"),
  emptyList: $("#empty-list"),
  listTitle: $("#list-title"),
  editorPlaceholder: $("#editor-placeholder"),
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

const prompts = [
  "今天有什么微小的事情，让你觉得生活还不错？",
  "如果给今天一种颜色，它会是什么？为什么？",
  "写下一个今天想感谢的人，哪怕没有告诉对方。",
  "今天的你，需要听见哪一句温柔的话？",
  "有什么普通的瞬间，值得未来的你再看一眼？",
  "最近有什么变化，正在悄悄发生？",
  "此刻放下手机，你最先注意到什么？",
];

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
const MAX_CUSTOM_STICKERS = 12;
const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_MEDIA_DATA_CHARACTERS = 3_200_000;
const DATA_IMAGE_PATTERN = /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z\d+/=\s]+$/i;
const ALLOWED_RICH_TAGS = new Set(["B", "BR", "DIV", "EM", "I", "IMG", "P", "S", "SPAN", "STRONG", "U"]);

const state = {
  selectedId: null,
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
};

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

function notifyEditorChanged() {
  elements.content.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    inputType: "insertFromPaste",
  }));
}

function insertTextAtCaret(text) {
  if (!state.selectedId || (state.mediaEntryId && state.mediaEntryId !== state.selectedId)) return false;
  elements.content.focus();
  const range = editorInsertionRange();
  range.deleteContents();
  const node = document.createTextNode(String(text || ""));
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  setEditorCaret(range);
  notifyEditorChanged();
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
  const image = document.createElement("img");
  image.src = dataUrl;
  image.className = mediaKind === "sticker" ? "inline-sticker" : "diary-image";
  image.dataset.mediaKind = mediaKind;
  image.alt = String(metadata.alt || (mediaKind === "sticker" ? "表情包" : "图片")).slice(0, 160);
  mediaMetadataAttributes(image, metadata);

  elements.content.focus();
  const range = rangeBelongsToEditor(targetRange) ? targetRange.cloneRange() : editorInsertionRange();
  range.deleteContents();
  range.insertNode(image);

  let caretNode;
  if (mediaKind === "sticker") {
    caretNode = document.createTextNode("\u00a0");
    image.after(caretNode);
    image.dayleafCompanionNodes = [caretNode];
  } else {
    const lineBreak = document.createElement("div");
    lineBreak.append(document.createElement("br"));
    if (metadata.attribution) {
      const credit = document.createElement("span");
      credit.className = "media-credit";
      credit.contentEditable = "false";
      credit.textContent = String(metadata.attribution).slice(0, 600);
      image.after(credit, lineBreak);
      image.dayleafCompanionNodes = [credit, lineBreak];
    } else {
      image.after(lineBreak);
      image.dayleafCompanionNodes = [lineBreak];
    }
    caretNode = lineBreak;
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
  notifyEditorChanged();
  return image;
}

function rollbackMediaInsertion(image) {
  if (!image?.parentNode) return;
  const parent = image.parentNode;
  const offset = [...parent.childNodes].indexOf(image);
  (image.dayleafCompanionNodes || []).forEach((node) => node.remove());
  image.remove();
  const range = document.createRange();
  range.setStart(parent, Math.max(0, Math.min(offset, parent.childNodes.length)));
  range.collapse(true);
  setEditorCaret(range);
  notifyEditorChanged();
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

function render() {
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
  const selectedDate = state.dateFilter || selected?.date;
  const entriesByDate = groupEntriesByDate(journalStore.getAll());
  const firstDay = new Date(year, month, 1);
  const leading = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

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
    cells.push(
      `<button class="${classes}" data-date="${dateKey}" aria-label="${dateKey}${entryCount ? `，${entryCount}篇日记` : ""}"><span>${day}</span>${countBadge}</button>`,
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
  if (!entry) return;

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
}

function selectEntry(id, { focus = false } = {}) {
  if (!journalStore.get(id)) return;
  if (!flushSave()) return;
  state.openverseControllers.sticker?.abort();
  state.openverseControllers.image?.abort();
  state.selectedId = id;
  const entry = currentEntry();
  state.monthCursor = new Date(parseDateKey(entry.date).getFullYear(), parseDateKey(entry.date).getMonth(), 1);
  render();
  elements.sidebar.classList.remove("mobile-open");
  if (focus) requestAnimationFrame(() => elements.title.focus());
}

function syncFilterButtons() {
  $$(".filter-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.filter === state.filter && !state.dateFilter);
  });
}

function showDate(date, { createIfEmpty = false } = {}) {
  if (!flushSave()) return;
  state.openverseControllers.sticker?.abort();
  state.openverseControllers.image?.abort();
  state.dateFilter = date;
  state.filter = "all";
  state.query = "";
  elements.search.value = "";
  syncFilterButtons();

  const entries = searchEntries(journalStore.getAll(), "", "all", date);
  if (!entries.length && createIfEmpty) {
    createEntry(date);
    return;
  }

  state.selectedId = entries[0]?.id || null;
  state.monthCursor = new Date(
    parseDateKey(date).getFullYear(),
    parseDateKey(date).getMonth(),
    1,
  );
  render();
  elements.sidebar.classList.remove("mobile-open");
}

function createEntry(date = toDateKey()) {
  if (!flushSave()) return;
  let entry;
  try {
    entry = journalStore.create({ date });
  } catch (error) {
    showStorageError(error);
    return;
  }
  const dayCount = journalStore.getAll().filter((item) => item.date === date).length;
  state.selectedId = entry.id;
  state.query = "";
  state.filter = "all";
  if (state.dateFilter !== date) {
    state.dateFilter = null;
  }
  elements.search.value = "";
  syncFilterButtons();
  state.monthCursor = new Date(parseDateKey(date).getFullYear(), parseDateKey(date).getMonth(), 1);
  render();
  requestAnimationFrame(() => elements.title.focus());
  showToast(dayCount > 1 ? `这一天的第 ${dayCount} 篇日记已准备好` : "新日记已准备好");
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
    state.selectedId = journalStore.getAll()[0]?.id || null;
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

  state.selectedId = importedLatest?.id || allEntries[0]?.id || null;
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

function bindEvents() {
  $("#new-entry-button").addEventListener("click", () => createEntry());
  $("#empty-new-button").addEventListener("click", () => createEntry(state.dateFilter || toDateKey()));
  $("#brand-button").addEventListener("click", () => {
    showDate(toDateKey());
  });
  elements.clearDateFilter.addEventListener("click", () => {
    state.dateFilter = null;
    syncFilterButtons();
    renderCalendar();
    renderList();
  });
  $("#previous-month").addEventListener("click", () => moveMonth(-1));
  $("#next-month").addEventListener("click", () => moveMonth(1));
  $("#mobile-menu-button").addEventListener("click", () => elements.sidebar.classList.toggle("mobile-open"));
  $("#mobile-back-button").addEventListener("click", () => {
    if (!flushSave()) return;
    state.selectedId = null;
    render();
  });

  elements.search.addEventListener("input", (event) => {
    state.dateFilter = null;
    state.query = event.target.value;
    syncFilterButtons();
    renderCalendar();
    renderList();
  });

  elements.entryList.addEventListener("click", (event) => {
    const card = event.target.closest("[data-entry-id]");
    if (card) selectEntry(card.dataset.entryId);
  });

  elements.calendarGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-date]");
    if (!button) return;
    showDate(button.dataset.date, { createIfEmpty: true });
  });

  $$(".filter-item").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      state.dateFilter = null;
      syncFilterButtons();
      renderCalendar();
      renderList();
    });
  });

  [elements.date, elements.title, elements.content, elements.tags].forEach((input) => {
    input.addEventListener("input", () => {
      updateEditorWordCount();
      scheduleSave();
    });
  });

  elements.form.addEventListener("submit", (event) => event.preventDefault());
  ["focus", "keyup", "mouseup", "input"].forEach((eventName) => {
    elements.content.addEventListener(eventName, captureEditorRange);
  });
  elements.content.addEventListener("click", (event) => {
    const image = event.target.closest?.("img[data-media-kind]");
    if (!image || !elements.content.contains(image)) return;
    const range = document.createRange();
    range.selectNode(image);
    setEditorCaret(range);
  });
  elements.content.addEventListener("keydown", (event) => {
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
    credit?.remove();
    selectedNode.remove();
    const nextRange = document.createRange();
    nextRange.setStart(parent, Math.min(offset, parent.childNodes.length));
    nextRange.collapse(true);
    setEditorCaret(nextRange);
    notifyEditorChanged();
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
      insertTextAtCaret(plainText || contentToText(richText, "html"));
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
      insertTextAtCaret(plainText || contentToText(richText, "html"));
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
    state.selectedId = searchEntries(
      journalStore.getAll(),
      state.query,
      state.filter,
      state.dateFilter,
    )[0]?.id || null;
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
    const modifier = event.metaKey || event.ctrlKey;
    if (modifier && event.key.toLowerCase() === "k") {
      event.preventDefault();
      elements.search.focus();
    }
    if (modifier && event.key.toLowerCase() === "n") {
      event.preventDefault();
      createEntry();
    }
    if (modifier && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (!flushSave()) return;
      renderStats();
      renderCalendar();
      renderList();
      showToast("日记已保存");
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (flushSave()) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

function initialize() {
  initializeTheme();
  $("#daily-prompt").textContent = prompts[new Date().getDay()];
  bindEvents();
  const entries = journalStore.getAll();
  const today = searchEntries(entries, "", "all", toDateKey())[0];
  state.selectedId = today?.id || searchEntries(entries, "")[0]?.id || null;
  render();

  const isNativeApp = document.documentElement.classList.contains("native-app");
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

window.dayleafNativePrepareToClose = flushSave;
window.dayleafNativeImportBackup = importNativeBackup;
window.dayleafNativeVerifyBackup = verifyNativeBackup;
window.dayleafTesting = {
  sanitizeRichContent,
  failNextSave() {
    state.forceNextSaveFailure = true;
  },
  insertEmoji(emoji) {
    state.mediaEntryId = state.selectedId;
    return insertTextAtCaret(emoji);
  },
  insertMediaDataUrl(dataUrl, kind = "image", metadata = {}) {
    state.mediaEntryId = state.selectedId;
    return Boolean(insertMediaDataUrl(dataUrl, kind, metadata));
  },
};
initialize();
