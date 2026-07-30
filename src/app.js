import { journalStore } from "./store.js";
import {
  MOODS,
  calculateStreak,
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

const state = {
  selectedId: null,
  query: "",
  filter: "all",
  dateFilter: null,
  monthCursor: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  saveTimer: null,
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

function render() {
  renderStats();
  renderCalendar();
  renderList();
  renderEditor();
}

function renderStats() {
  const entries = journalStore.getAll();
  const totalWords = entries.reduce(
    (sum, entry) => sum + getWordCount(`${entry.title} ${entry.content}`),
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
  const preview = entry.content.trim().replace(/\s+/g, " ") || "还没有写下正文…";
  const entryTime = formatEntryTime(entry.createdAt);
  const tags = (entry.tags || [])
    .slice(0, 2)
    .map((tag) => `<span>#${escapeHtml(tag)}</span>`)
    .join("");
  return `
    <button class="entry-card ${entry.id === state.selectedId ? "selected" : ""}" data-entry-id="${entry.id}">
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
  const entry = currentEntry();
  elements.editorPlaceholder.hidden = Boolean(entry);
  elements.form.hidden = !entry;
  if (!entry) return;

  elements.date.value = entry.date;
  elements.title.value = entry.title;
  elements.content.value = entry.content;
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
  flushSave();
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
  flushSave();
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
  flushSave();
  const entry = journalStore.create({ date });
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
    content: elements.content.value,
    tags: normalizeTags(elements.tags.value),
  };
}

function persistForm() {
  const entry = currentEntry();
  if (!entry) return null;
  const updated = journalStore.update(entry.id, collectFormData());
  if (updated && state.dateFilter === entry.date && updated.date !== entry.date) {
    state.dateFilter = updated.date;
  }
  return updated;
}

function scheduleSave() {
  if (!state.selectedId) return;
  setSaveState("正在保存…", true);
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    persistForm();
    state.saveTimer = null;
    setSaveState("已保存");
    renderStats();
    renderCalendar();
    renderList();
  }, 500);
}

function flushSave() {
  if (!state.saveTimer || !state.selectedId) return;
  clearTimeout(state.saveTimer);
  persistForm();
  state.saveTimer = null;
  setSaveState("已保存");
}

function updateEditorWordCount() {
  const count = getWordCount(`${elements.title.value} ${elements.content.value}`);
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
  flushSave();
  const payload = {
    app: "Dayleaf",
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: journalStore.getAll(),
  };
  downloadFile(
    `dayleaf-backup-${toDateKey()}.json`,
    JSON.stringify(payload, null, 2),
    "application/json",
  );
  showToast("完整备份已导出");
}

function exportMarkdown() {
  flushSave();
  const markdown = journalStore
    .getAll()
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
    .map((entry) => {
      const tags = entry.tags.length ? `\n标签：${entry.tags.map((tag) => `#${tag}`).join(" ")}` : "";
      const mood = entry.mood ? `\n心情：${MOODS[entry.mood]} ${entry.mood}` : "";
      return `# ${entry.title || "无题日记"}\n\n日期：${entry.date}${mood}${tags}\n\n${entry.content}`;
    })
    .join("\n\n---\n\n");
  downloadFile(`dayleaf-${toDateKey()}.md`, markdown || "# 我的日叶\n", "text/markdown");
  showToast("Markdown 已导出");
}

async function importBackup(file) {
  try {
    const payload = JSON.parse(await file.text());
    if (payload.app !== "Dayleaf" || !Array.isArray(payload.entries)) {
      throw new Error("invalid backup");
    }
    journalStore.replaceAll(payload.entries);
    state.selectedId = journalStore.getAll()[0]?.id || null;
    state.dateFilter = null;
    state.filter = "all";
    state.query = "";
    elements.search.value = "";
    syncFilterButtons();
    render();
    elements.backupDialog.close();
    showToast(`已恢复 ${payload.entries.length} 篇日记`);
  } catch {
    showToast("无法读取这个备份文件");
  } finally {
    elements.importInput.value = "";
  }
}

function importNativeBackup(backupText) {
  const payload = JSON.parse(backupText);
  if (payload.app !== "Dayleaf" || !Array.isArray(payload.entries)) {
    throw new Error("invalid backup");
  }

  const allById = new Map(journalStore.getAll().map((entry) => [entry.id, entry]));
  for (const incomingEntry of payload.entries) {
    const existingEntry = allById.get(incomingEntry.id);
    const existingUpdatedAt = Date.parse(existingEntry?.updatedAt || "") || 0;
    const incomingUpdatedAt = Date.parse(incomingEntry.updatedAt || "") || 0;
    if (!existingEntry || incomingUpdatedAt >= existingUpdatedAt) {
      allById.set(incomingEntry.id, incomingEntry);
    }
  }

  journalStore.replaceAll([...allById.values()]);
  const allEntries = journalStore.getAll();
  const latestIncoming = [...payload.entries].sort((a, b) =>
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
  journalStore.setPreference("theme", theme);
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
    flushSave();
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

  elements.moodPicker.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mood]");
    if (!button || !state.selectedId) return;
    flushSave();
    const entry = currentEntry();
    journalStore.update(state.selectedId, { mood: entry.mood === button.dataset.mood ? "" : button.dataset.mood });
    render();
  });

  elements.favoriteButton.addEventListener("click", () => {
    flushSave();
    const entry = currentEntry();
    if (!entry) return;
    journalStore.update(entry.id, { favorite: !entry.favorite });
    render();
    showToast(entry.favorite ? "已取消珍藏" : "已加入珍藏");
  });

  $("#delete-button").addEventListener("click", () => elements.deleteDialog.showModal());
  $("#confirm-delete-button").addEventListener("click", () => {
    flushSave();
    const id = state.selectedId;
    if (!id) return;
    journalStore.delete(id);
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
      flushSave();
      renderStats();
      renderCalendar();
      renderList();
      showToast("日记已保存");
    }
  });

  window.addEventListener("beforeunload", flushSave);
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
initialize();
