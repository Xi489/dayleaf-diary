import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateStreak,
  contentToText,
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
