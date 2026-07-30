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

export function searchEntries(entries, query, filter = "all") {
  const term = query.trim().toLocaleLowerCase("zh-CN");
  return entries
    .filter((entry) => filter !== "favorite" || entry.favorite)
    .filter((entry) => {
      if (!term) return true;
      return [entry.title, entry.content, ...(entry.tags || []), entry.mood]
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
