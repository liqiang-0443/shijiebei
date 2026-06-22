const test = require("node:test");
const assert = require("node:assert/strict");
const { liveCardHtml } = require("../public/live");

test("renders a compact score row without the unused match code", () => {
  const html = liveCardHtml({
    home: "西班牙",
    away: "沙特",
    score: { home: 4, away: 0 },
    status: "finished",
    progressText: "已完成",
    scheduledAt: "2026-06-22 00:00",
  });

  assert.match(html, /live-scoreboard/);
  assert.doesNotMatch(html, /match-code/);
  assert.match(html, /西班牙/);
  assert.match(html, /4 : 0/);
});

test("highlights a live score row with its current stage", () => {
  const html = liveCardHtml({
    home: "西班牙",
    away: "沙特",
    score: { home: 1, away: 0 },
    status: "second_half",
    progressText: "下半场 63'",
    scheduledAt: "2026-06-22 00:00",
  });

  assert.match(html, /is-live/);
  assert.match(html, /下半场 63'/);
});
