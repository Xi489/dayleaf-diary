import test from "node:test";
import assert from "node:assert/strict";
import { JournalStore } from "../src/store.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.failWrites = false;
    this.failNextKey = null;
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    if (this.failWrites) throw new Error("storage quota exceeded");
    if (this.failNextKey === key) {
      this.failNextKey = null;
      throw new Error("storage quota exceeded");
    }
    this.values.set(key, String(value));
  }
}

test("stores multiple independent entries on the same date", () => {
  const storage = new MemoryStorage();
  const store = new JournalStore(storage);
  const morning = store.create({ date: "2026-07-31", title: "上午" });
  const evening = store.create({ date: "2026-07-31", title: "晚上" });

  assert.notEqual(morning.id, evening.id);
  assert.equal(store.getAll().filter((entry) => entry.date === "2026-07-31").length, 2);
  assert.deepEqual(store.getAll().map((entry) => entry.title), ["上午", "晚上"]);

  const reopenedStore = new JournalStore(storage);
  assert.deepEqual(reopenedStore.getAll().map((entry) => entry.id), [morning.id, evening.id]);
});

test("defaults old entries to text and preserves explicit rich content", () => {
  const storage = new MemoryStorage();
  storage.values.set(
    "dayleaf.entries.v1",
    JSON.stringify([
      {
        id: "old",
        date: "2026-07-30",
        title: "旧日记",
        content: "文字内容",
        createdAt: "2026-07-30T08:00:00Z",
        updatedAt: "2026-07-30T08:00:00Z",
      },
    ]),
  );

  const store = new JournalStore(storage);
  assert.equal(store.get("old").contentFormat, "text");

  const rich = store.create({ content: "<p>图文</p>", contentFormat: "html" });
  assert.equal(rich.contentFormat, "html");
  assert.equal(new JournalStore(storage).get(rich.id).contentFormat, "html");
});

test("rolls back entry mutations when persistence fails", () => {
  const storage = new MemoryStorage();
  const store = new JournalStore(storage);
  const original = store.create({ id: "original", title: "原文" });
  const before = store.getAll();
  storage.failWrites = true;

  assert.throws(() => store.create({ id: "new", title: "不应留下" }), /quota/);
  assert.deepEqual(store.getAll(), before);

  assert.throws(() => store.update(original.id, { title: "不应更新" }), /quota/);
  assert.deepEqual(store.getAll(), before);

  assert.throws(() => store.replaceAll([{ id: "replacement", title: "不应替换" }]), /quota/);
  assert.deepEqual(store.getAll(), before);
});

test("rolls back preferences when persistence fails", () => {
  const storage = new MemoryStorage();
  const store = new JournalStore(storage);
  store.setPreference("theme", "paper");
  storage.failWrites = true;

  assert.throws(() => store.setPreference("theme", "night"), /quota/);
  assert.equal(store.getPreference("theme"), "paper");
  assert.equal(store.getPreference("missing", "fallback"), "fallback");
});

test("recovers from malformed preference container values", () => {
  for (const value of ["null", "[]", '"invalid"', "42"]) {
    const storage = new MemoryStorage();
    storage.values.set("dayleaf.preferences.v1", value);
    const store = new JournalStore(storage);
    assert.equal(store.getPreference("theme", "fallback"), "fallback");
    assert.doesNotThrow(() => store.setPreference("theme", "light"));
    assert.equal(store.getPreference("theme"), "light");
  }
});

test("restores entries and preferences atomically when a backup write fails", () => {
  const storage = new MemoryStorage();
  const store = new JournalStore(storage);
  store.create({ id: "kept", title: "原日记" });
  store.setPreference("customStickers", [{ id: "kept-sticker" }]);
  const storedEntriesBefore = storage.getItem("dayleaf.entries.v1");
  const storedPreferencesBefore = storage.getItem("dayleaf.preferences.v1");

  storage.failNextKey = "dayleaf.preferences.v1";
  assert.throws(
    () => store.replaceAllWithPreferences(
      [{ id: "replacement", title: "不应留下" }],
      { customStickers: [{ id: "replacement-sticker" }] },
    ),
    /quota/,
  );

  assert.equal(store.get("replacement"), null);
  assert.equal(store.get("kept").title, "原日记");
  assert.deepEqual(store.getPreference("customStickers"), [{ id: "kept-sticker" }]);
  assert.equal(storage.getItem("dayleaf.entries.v1"), storedEntriesBefore);
  assert.equal(storage.getItem("dayleaf.preferences.v1"), storedPreferencesBefore);
});
