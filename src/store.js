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
    contentFormat: entry.contentFormat === "html" ? "html" : "text",
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
      const preferences = JSON.parse(this.storage.getItem(PREFERENCES_KEY) || "{}");
      return preferences && typeof preferences === "object" && !Array.isArray(preferences)
        ? preferences
        : {};
    } catch {
      return {};
    }
  }

  persist() {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
  }

  commitEntries(nextEntries) {
    const previousEntries = this.entries;
    this.entries = nextEntries;
    try {
      this.persist();
    } catch (error) {
      this.entries = previousEntries;
      throw error;
    }
  }

  getAll() {
    return [...this.entries];
  }

  get(id) {
    return this.entries.find((entry) => entry.id === id) || null;
  }

  create(initial = {}) {
    const entry = sanitizeEntry(initial);
    this.commitEntries([...this.entries, entry]);
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
    const nextEntries = [...this.entries];
    nextEntries[index] = next;
    this.commitEntries(nextEntries);
    return next;
  }

  delete(id) {
    const nextEntries = this.entries.filter((entry) => entry.id !== id);
    if (nextEntries.length !== this.entries.length) this.commitEntries(nextEntries);
  }

  replaceAll(entries) {
    this.commitEntries(entries.map(sanitizeEntry));
  }

  replaceAllWithPreferences(entries, preferenceUpdates = {}) {
    const previousEntries = this.entries;
    const previousPreferences = this.preferences;
    const nextEntries = entries.map(sanitizeEntry);
    const nextPreferences = { ...this.preferences, ...preferenceUpdates };

    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
      this.storage.setItem(PREFERENCES_KEY, JSON.stringify(nextPreferences));
    } catch (error) {
      try {
        this.storage.setItem(STORAGE_KEY, JSON.stringify(previousEntries));
      } catch {}
      try {
        this.storage.setItem(PREFERENCES_KEY, JSON.stringify(previousPreferences));
      } catch {}
      throw error;
    }

    this.entries = nextEntries;
    this.preferences = nextPreferences;
  }

  setPreference(key, value) {
    const previousPreferences = this.preferences;
    this.preferences = { ...this.preferences, [key]: value };
    try {
      this.storage.setItem(PREFERENCES_KEY, JSON.stringify(this.preferences));
    } catch (error) {
      this.preferences = previousPreferences;
      throw error;
    }
  }

  getPreference(key, fallback = null) {
    return this.preferences[key] ?? fallback;
  }
}

export const journalStore = new JournalStore();
export { JournalStore };
