import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateStreak,
  getWordCount,
  groupEntriesByDate,
  normalizeTags,
  searchEntries,
} from "../src/utils.js";

test("normalizes and deduplicates tags", () => {
  assert.deepEqual(normalizeTags("生活, #阅读，生活,  周末 "), ["生活", "阅读", "周末"]);
});

test("counts CJK characters and latin words", () => {
  assert.equal(getWordCount("今天 feel so good"), 5);
  assert.equal(getWordCount(""), 0);
});

test("calculates a streak ending today", () => {
  const entries = [
    { date: "2026-07-30" },
    { date: "2026-07-29" },
    { date: "2026-07-28" },
    { date: "2026-07-26" },
  ];
  assert.equal(calculateStreak(entries, new Date(2026, 6, 30)), 3);
});

test("allows a streak ending yesterday", () => {
  const entries = [{ date: "2026-07-29" }, { date: "2026-07-28" }];
  assert.equal(calculateStreak(entries, new Date(2026, 6, 30)), 2);
});

test("counts multiple entries on one day as one streak day", () => {
  const entries = [
    { date: "2026-07-30" },
    { date: "2026-07-30" },
    { date: "2026-07-29" },
  ];
  assert.equal(calculateStreak(entries, new Date(2026, 6, 30)), 2);
});

test("groups multiple entries under the same calendar date", () => {
  const grouped = groupEntriesByDate([
    { id: "morning", date: "2026-07-30" },
    { id: "evening", date: "2026-07-30" },
    { id: "next-day", date: "2026-07-31" },
  ]);
  assert.deepEqual(grouped.get("2026-07-30").map((entry) => entry.id), ["morning", "evening"]);
  assert.equal(grouped.get("2026-07-31").length, 1);
});

test("shows the most recently updated same-day entry first", () => {
  const entries = [
    { id: "earlier", date: "2026-07-31", updatedAt: "2026-07-31T08:00:00Z" },
    { id: "later", date: "2026-07-31", updatedAt: "2026-07-31T20:00:00Z" },
  ];
  assert.deepEqual(
    searchEntries(entries, "", "all", "2026-07-31").map((entry) => entry.id),
    ["later", "earlier"],
  );
});

test("searches title, body, mood, and tags", () => {
  const entries = [
    {
      id: "1",
      date: "2026-07-30",
      updatedAt: "2026-07-30T10:00:00Z",
      title: "雨后散步",
      content: "空气很好",
      mood: "平静",
      tags: ["生活"],
      favorite: true,
    },
    {
      id: "2",
      date: "2026-07-29",
      updatedAt: "2026-07-29T10:00:00Z",
      title: "读书",
      content: "读完一章",
      mood: "雀跃",
      tags: ["阅读"],
      favorite: false,
    },
  ];
  assert.equal(searchEntries(entries, "空气").length, 1);
  assert.equal(searchEntries(entries, "阅读").length, 1);
  assert.equal(searchEntries(entries, "", "favorite").length, 1);
  assert.deepEqual(
    searchEntries(entries, "", "all", "2026-07-30").map((entry) => entry.id),
    ["1"],
  );
});
