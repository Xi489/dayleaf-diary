export const MOODS = {
  晴朗: "☀️",
  平静: "🌿",
  雀跃: "✨",
  低落: "🌧️",
  疲惫: "🌙",
};

export const SPLASH_VISIBLE_MS = 2400;
export const SPLASH_FADE_MS = 360;

export const SPLASH_MESSAGES = Object.freeze([
  Object.freeze({ text: "不积跬步，无以至千里；不积小流，无以成江海。", source: "《荀子·劝学》" }),
  Object.freeze({ text: "知者不惑，仁者不忧，勇者不惧。", source: "《论语·子罕》" }),
  Object.freeze({ text: "山重水复疑无路，柳暗花明又一村。", source: "陆游《游山西村》" }),
  Object.freeze({ text: "长风破浪会有时，直挂云帆济沧海。", source: "李白《行路难·其一》" }),
  Object.freeze({ text: "路漫漫其修远兮，吾将上下而求索。", source: "屈原《离骚》" }),
  Object.freeze({ text: "千磨万击还坚劲，任尔东西南北风。", source: "郑燮《竹石》" }),
  Object.freeze({ text: "允许今天只是今天，不必立刻成为答案。", source: "日叶 · 今日寄语" }),
  Object.freeze({ text: "每一次诚实的记录，都是在替未来的自己保存光。", source: "日叶 · 今日寄语" }),
  Object.freeze({ text: "先写下一句，心里的路就会慢慢显出来。", source: "日叶 · 今日寄语" }),
  Object.freeze({ text: "你不需要把所有事情想明白，才可以继续向前。", source: "日叶 · 今日寄语" }),
  Object.freeze({ text: "愿你在自己的节奏里，慢慢成为想成为的人。", source: "日叶 · 今日寄语" }),
  Object.freeze({ text: "把今天轻轻放进文字里，明天便多了一盏回望的灯。", source: "日叶 · 今日寄语" }),
]);

export const WRITING_PROMPTS = Object.freeze([
  "今天的你，需要听见哪一句温柔的话？",
  "此刻有什么细小的事情，值得被你记住？",
  "今天哪一刻，你感到自己正在认真生活？",
  "如果把今天比作一种天气，它会是什么？",
  "今天有什么情绪，正在等待你为它命名？",
  "哪件看似普通的小事，让你悄悄开心了一下？",
  "今天的你，最想感谢谁，又想对他说什么？",
  "此刻放下一个担忧，你希望留下什么？",
  "今天学到的哪件小事，可能会改变明天？",
  "如果能给清晨的自己留句话，你会写什么？",
  "今天有什么没有说出口，却值得写下来的话？",
  "最近哪一个瞬间，让你重新感到有力量？",
  "明天醒来时，你希望自己记得今天的什么？",
  "此刻的生活里，哪一件事正慢慢变好？",
  "今天的遗憾，是否也藏着一种新的可能？",
  "如果今天是一页书，你会为它取什么标题？",
]);

export function selectWritingPrompt(randomValue = Math.random(), previousIndex = -1) {
  const numericValue = Number(randomValue);
  const normalized = Number.isFinite(numericValue)
    ? Math.min(Math.max(numericValue, 0), 1 - Number.EPSILON)
    : 0;
  let index = Math.floor(normalized * WRITING_PROMPTS.length);

  if (
    WRITING_PROMPTS.length > 1 &&
    Number.isInteger(previousIndex) &&
    previousIndex >= 0 &&
    previousIndex < WRITING_PROMPTS.length &&
    index === previousIndex
  ) {
    index = (index + 1) % WRITING_PROMPTS.length;
  }

  return { text: WRITING_PROMPTS[index], index };
}

export function selectSplashMessage(randomValue = Math.random()) {
  const numericValue = Number(randomValue);
  const normalized = Number.isFinite(numericValue)
    ? Math.min(Math.max(numericValue, 0), 1 - Number.EPSILON)
    : 0;
  const index = Math.floor(normalized * SPLASH_MESSAGES.length);
  return { ...SPLASH_MESSAGES[index], index };
}

export function isApplePlatform(platform = "") {
  return /mac|iphone|ipad|ipod/i.test(String(platform));
}

export function shortcutModifierLabel(platform = "") {
  return isApplePlatform(platform) ? "⌘" : "Ctrl";
}

function hasPrimaryShortcutModifier(event) {
  return Boolean(
    event &&
    !event.altKey &&
    !event.isComposing &&
    !event.repeat &&
    !(typeof event.getModifierState === "function" && event.getModifierState("AltGraph")) &&
    (event.metaKey || event.ctrlKey)
  );
}

export function isPrimaryShortcut(event, key) {
  return Boolean(
    hasPrimaryShortcutModifier(event) &&
    !event.shiftKey &&
    String(event.key || "").toLowerCase() === String(key || "").toLowerCase(),
  );
}

export function isUndoShortcut(event) {
  return Boolean(
    hasPrimaryShortcutModifier(event) &&
    !event.shiftKey &&
    String(event.key || "").toLowerCase() === "z",
  );
}

export function isRedoShortcut(event) {
  if (!hasPrimaryShortcutModifier(event)) return false;
  const key = String(event.key || "").toLowerCase();
  return Boolean(
    (key === "z" && event.shiftKey) ||
    (key === "y" && event.ctrlKey && !event.metaKey && !event.shiftKey),
  );
}

export function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatEntryDate(dateKey) {
  const date = parseDateKey(dateKey);
  const today = toDateKey();
  const yesterday = toDateKey(new Date(new Date().setDate(new Date().getDate() - 1)));
  if (dateKey === today) return "今天";
  if (dateKey === yesterday) return "昨天";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

export function formatEntryTime(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function normalizeTags(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(/[,，]/);
  return [...new Set(source.map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean))].slice(0, 8);
}

export function getWordCount(text) {
  const normalized = String(text || "").trim();
  if (!normalized) return 0;
  const cjk = normalized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) || [];
  const latin = normalized
    .replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu, " ")
    .match(/[A-Za-zÀ-ÖØ-öø-ÿ0-9]+(?:['’-][A-Za-zÀ-ÖØ-öø-ÿ0-9]+)*/g) || [];
  return cjk.length + latin.length;
}

export function calculateStreak(entries, today = new Date()) {
  const dates = new Set(entries.map((entry) => entry.date));
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (!dates.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (dates.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function groupEntriesByDate(entries) {
  return entries.reduce((groups, entry) => {
    const sameDay = groups.get(entry.date) || [];
    sameDay.push(entry);
    groups.set(entry.date, sameDay);
    return groups;
  }, new Map());
}

const HTML_ENTITIES = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: "\u00a0",
  quot: '"',
};

function decodeHtmlEntities(value) {
  return String(value).replace(/&(#(?:x[\da-f]+|\d+)|[a-z][\da-z]+);/gi, (entity, code) => {
    if (code[0] !== "#") return HTML_ENTITIES[code.toLowerCase()] ?? entity;

    const hexadecimal = code[1]?.toLowerCase() === "x";
    const point = Number.parseInt(code.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    if (!Number.isInteger(point) || point < 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) {
      return entity;
    }
    return String.fromCodePoint(point);
  });
}

function imageAltText(tag) {
  const match = tag.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
  const alt = decodeHtmlEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
  return alt ? ` ${alt} ` : " ";
}

export function contentToText(content, format = "text") {
  const source = String(content ?? "");
  if (format !== "html") return source;

  const text = source
    .replace(/<!--[^]*?-->/g, "")
    .replace(/<(script|style|template)\b(?:[^>"']|"[^"]*"|'[^']*')*>[^]*?<\/\1\s*>/gi, "")
    .replace(/<span\b[^>]*class\s*=\s*(?:"[^"]*\bmedia-credit\b[^"]*"|'[^']*\bmedia-credit\b[^']*')[^>]*>[^]*?<\/span\s*>/gi, "")
    .replace(/<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, imageAltText)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(?:address|article|aside|blockquote|dd|div|dl|dt|figcaption|figure|footer|h[1-6]|header|li|main|nav|ol|p|pre|section|tr|ul)\s*>/gi, "\n")
    .replace(/<\/\s*(?:td|th)\s*>/gi, "\t")
    .replace(/<[^>]*>/g, "");

  return decodeHtmlEntities(text)
    .replace(/\u00a0/g, " ")
    .replace(/[\t \f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function searchEntries(entries, query, filter = "all", date = null) {
  const term = query.trim().toLocaleLowerCase("zh-CN");
  return entries
    .filter((entry) => filter !== "favorite" || entry.favorite)
    .filter((entry) => !date || entry.date === date)
    .filter((entry) => {
      if (!term) return true;
      return [entry.title, contentToText(entry.content, entry.contentFormat), ...(entry.tags || []), entry.mood]
        .join(" ")
        .toLocaleLowerCase("zh-CN")
        .includes(term);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
