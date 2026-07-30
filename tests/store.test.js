import test from "node:test";
import assert from "node:assert/strict";
import { JournalStore } from "../src/store.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
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
