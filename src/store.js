import { normalizeTags, toDateKey } from "./utils.js";

const STORAGE_KEY = "dayleaf.entries.v1";
const PREFERENCES_KEY = "dayleaf.preferences.v1";

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeEntry(entry) {
  const now = new Date().toISOString();
  return {
    id: String(entry.id || createId()),
    date: /^\d{4}-\d{2}-\d{2}$/.test(entry.date) ? entry.date : toDateKey(),
    title: String(entry.title || "").slice(0, 100),
    content: String(entry.content || ""),
    mood: String(entry.mood || ""),
    tags: normalizeTags(entry.tags),
    favorite: Boolean(entry.favorite),
    createdAt: entry.createdAt || now,
    updatedAt: entry.updatedAt || now,
  };
}

class JournalStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.entries = this.readEntries();
    this.preferences = this.readPreferences();
  }

  readEntries() {
    try {
      const value = JSON.parse(this.storage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value.map(sanitizeEntry) : [];
    } catch {
      return [];
    }
  }

  readPreferences() {
    try {
      return JSON.parse(this.storage.getItem(PREFERENCES_KEY) || "{}");
    } catch {
      return {};
    }
  }

  persist() {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
  }

  getAll() {
    return [...this.entries];
  }

  get(id) {
    return this.entries.find((entry) => entry.id === id) || null;
  }

  create(initial = {}) {
    const entry = sanitizeEntry(initial);
    this.entries.push(entry);
    this.persist();
    return entry;
  }

  update(id, updates) {
    const index = this.entries.findIndex((entry) => entry.id === id);
    if (index < 0) return null;
    const current = this.entries[index];
    const next = sanitizeEntry({
      ...current,
      ...updates,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    });
    this.entries[index] = next;
    this.persist();
    return next;
  }

  delete(id) {
    const previousLength = this.entries.length;
    this.entries = this.entries.filter((entry) => entry.id !== id);
    if (this.entries.length !== previousLength) this.persist();
  }

  replaceAll(entries) {
    this.entries = entries.map(sanitizeEntry);
    this.persist();
  }

  setPreference(key, value) {
    this.preferences[key] = value;
    this.storage.setItem(PREFERENCES_KEY, JSON.stringify(this.preferences));
  }

  getPreference(key, fallback = null) {
    return this.preferences[key] ?? fallback;
  }
}

export const journalStore = new JournalStore();
export { JournalStore };
