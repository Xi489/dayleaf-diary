import test from "node:test";
import assert from "node:assert/strict";
import {
  SPLASH_FADE_MS,
  SPLASH_MESSAGES,
  SPLASH_VISIBLE_MS,
  WRITING_PROMPTS,
  calculateStreak,
  contentToText,
  getWordCount,
  groupEntriesByDate,
  isApplePlatform,
  isPrimaryShortcut,
  isRedoShortcut,
  isUndoShortcut,
  normalizeTags,
  searchEntries,
  selectSplashMessage,
  selectWritingPrompt,
  shortcutModifierLabel,
} from "../src/utils.js";

test("normalizes and deduplicates tags", () => {
  assert.deepEqual(normalizeTags("生活, #阅读，生活,  周末 "), ["生活", "阅读", "周末"]);
});

test("counts CJK characters and latin words", () => {
  assert.equal(getWordCount("今天 feel so good"), 5);
  assert.equal(getWordCount(""), 0);
});

test("uses familiar shortcut modifiers across desktop and iPad keyboards", () => {
  assert.equal(isApplePlatform("MacIntel"), true);
  assert.equal(isApplePlatform("iPad"), true);
  assert.equal(isApplePlatform("Win32"), false);
  assert.equal(shortcutModifierLabel("MacIntel"), "⌘");
  assert.equal(shortcutModifierLabel("iPhone"), "⌘");
  assert.equal(shortcutModifierLabel("Win32"), "Ctrl");
  assert.equal(shortcutModifierLabel("Linux x86_64"), "Ctrl");
});

test("recognizes Command and Control app shortcuts without hijacking modified variants", () => {
  assert.equal(isPrimaryShortcut({ key: "K", metaKey: true }, "k"), true);
  assert.equal(isPrimaryShortcut({ key: "k", ctrlKey: true }, "k"), true);
  assert.equal(isPrimaryShortcut({ key: "k", ctrlKey: true, shiftKey: true }, "k"), false);
  assert.equal(isPrimaryShortcut({ key: "k", ctrlKey: true, altKey: true }, "k"), false);
  assert.equal(isPrimaryShortcut({ key: "k", ctrlKey: true, isComposing: true }, "k"), false);
  assert.equal(isPrimaryShortcut({ key: "k", ctrlKey: true, repeat: true }, "k"), false);
  assert.equal(
    isPrimaryShortcut({ key: "k", ctrlKey: true, getModifierState: () => true }, "k"),
    false,
  );
  assert.equal(isPrimaryShortcut({ key: "c" }, "c"), false);
});

test("recognizes native undo and redo conventions on Apple and Windows keyboards", () => {
  assert.equal(isUndoShortcut({ key: "z", metaKey: true }), true);
  assert.equal(isUndoShortcut({ key: "Z", ctrlKey: true }), true);
  assert.equal(isRedoShortcut({ key: "z", metaKey: true, shiftKey: true }), true);
  assert.equal(isRedoShortcut({ key: "z", ctrlKey: true, shiftKey: true }), true);
  assert.equal(isRedoShortcut({ key: "y", ctrlKey: true }), true);
  assert.equal(isRedoShortcut({ key: "y", metaKey: true }), false);
  assert.equal(isRedoShortcut({ key: "z", metaKey: true, shiftKey: true, isComposing: true }), false);
});

test("selects every launch message deterministically and stays within the requested timing", () => {
  const first = selectSplashMessage(0);
  const last = selectSplashMessage(1);

  assert.equal(first.index, 0);
  assert.deepEqual(
    { text: last.text, source: last.source },
    SPLASH_MESSAGES[SPLASH_MESSAGES.length - 1],
  );
  assert.equal(last.index, SPLASH_MESSAGES.length - 1);
  assert.ok(SPLASH_MESSAGES.length >= 10);
  assert.equal(new Set(SPLASH_MESSAGES.map(({ text }) => text)).size, SPLASH_MESSAGES.length);
  assert.ok(SPLASH_MESSAGES.every(({ text, source }) => text.length >= 10 && source.length > 0));
  assert.ok(SPLASH_VISIBLE_MS >= 2000 && SPLASH_VISIBLE_MS <= 3000);
  assert.ok(SPLASH_VISIBLE_MS + SPLASH_FADE_MS <= 3000);
});

test("selects writing prompts deterministically at both random boundaries", () => {
  assert.deepEqual(selectWritingPrompt(0), { text: WRITING_PROMPTS[0], index: 0 });
  assert.deepEqual(selectWritingPrompt(1), {
    text: WRITING_PROMPTS[WRITING_PROMPTS.length - 1],
    index: WRITING_PROMPTS.length - 1,
  });
  assert.equal(selectWritingPrompt(-10).index, 0);
  assert.equal(selectWritingPrompt(10).index, WRITING_PROMPTS.length - 1);
  assert.equal(selectWritingPrompt(Number.NaN).index, 0);
  assert.equal(selectWritingPrompt(Number.POSITIVE_INFINITY).index, 0);
});

test("keeps writing prompts unique, non-empty, and varied", () => {
  assert.ok(WRITING_PROMPTS.length >= 14);
  assert.equal(new Set(WRITING_PROMPTS).size, WRITING_PROMPTS.length);
  assert.ok(WRITING_PROMPTS.every((prompt) => typeof prompt === "string" && prompt.trim().length > 0));
});

test("avoids returning the same writing prompt twice in a row", () => {
  const middleIndex = Math.floor(WRITING_PROMPTS.length / 2);
  const sameBucketValue = (middleIndex + 0.25) / WRITING_PROMPTS.length;
  const shifted = selectWritingPrompt(sameBucketValue, middleIndex);
  assert.equal(shifted.index, (middleIndex + 1) % WRITING_PROMPTS.length);
  assert.notEqual(shifted.text, WRITING_PROMPTS[middleIndex]);

  const wrapped = selectWritingPrompt(1, WRITING_PROMPTS.length - 1);
  assert.equal(wrapped.index, 0);
  assert.equal(wrapped.text, WRITING_PROMPTS[0]);

  assert.equal(selectWritingPrompt(0, -1).index, 0);
  assert.equal(selectWritingPrompt(0, WRITING_PROMPTS.length).index, 0);
});

test("converts rich diary content to searchable plain text", () => {
  const content = [
    '<p>雨后&nbsp;散步<br>空气很好 &amp; 清新</p>',
    '<p><img class="inline-sticker" src="data:image/png;base64,test" alt="开心 &quot;贴纸&quot;"> 出发</p>',
    '<figure><img class="diary-image" src="data:image/png;base64,test" alt="湖边照片"><figcaption>傍晚</figcaption></figure>',
  ].join("");

  assert.equal(contentToText(content, "html"), '雨后 散步\n空气很好 & 清新\n开心 "贴纸" 出发\n湖边照片 傍晚');
  assert.equal(contentToText("原样保留 &amp; <标签>", "text"), "原样保留 &amp; <标签>");
});

test("decodes numeric entities and ignores non-content HTML", () => {
  assert.equal(
    contentToText('<p>&#20170;&#x5929;</p><script>不应搜索</script><style>.hidden{}</style>', "html"),
    "今天",
  );
});

test("omits media attribution captions from diary previews and word counts", () => {
  assert.equal(
    contentToText(
      '<p>散步</p><img src="data:image/png;base64,AA==" alt="图片：树林"><span class="media-credit">Openverse · Example Creator</span>',
      "html",
    ),
    "散步\n图片：树林",
  );
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

test("searches visible rich text and image descriptions instead of markup", () => {
  const entries = [
    {
      id: "rich",
      date: "2026-07-31",
      updatedAt: "2026-07-31T10:00:00Z",
      title: "",
      content: '<p>今天很开心</p><img class="inline-sticker" alt="猫咪挥手" src="data:image/png;base64,abc">',
      contentFormat: "html",
      mood: "",
      tags: [],
      favorite: false,
    },
  ];

  assert.equal(searchEntries(entries, "猫咪挥手").length, 1);
  assert.equal(searchEntries(entries, "今天很开心").length, 1);
  assert.equal(searchEntries(entries, "inline-sticker").length, 0);
});
