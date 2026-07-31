export const MOODS = {
  晴朗: "☀️",
  平静: "🌿",
  雀跃: "✨",
  低落: "🌧️",
  疲惫: "🌙",
};

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
