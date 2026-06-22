const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeLiveMatch,
  livePayload,
  parseLiveMatches,
  normalizeTheSportsDbEvent,
  formatLiveProgress,
} = require("../lib/live-results");

test("normalizes a live score and minute", () => {
  const match = normalizeLiveMatch({
    id: "f1",
    home: "A",
    away: "B",
    homeScore: "1",
    awayScore: "0",
    status: "上半场",
    minute: "43",
  });
  assert.deepEqual(match, {
    key: "f1",
    home: "A",
    away: "B",
    score: { home: 1, away: 0 },
    status: "first_half",
    minute: 43,
    events: [],
  });
});

test("keeps the last successful list when a refresh fails", () => {
  const payload = livePayload([{ key: "f1" }], "2026-06-22T08:00:00.000Z", "source unavailable");
  assert.equal(payload.stale, true);
  assert.equal(payload.matches.length, 1);
});

test("parses a World Cup live row from the score page", () => {
  const html = `
    <tr id="a1359210" status="4">
      <td>周日037</td><td class="ssbox_01"><a>世界杯</a></td><td>第2轮</td>
      <td>06-22 00:00</td><td><span class="red">完</span></td>
      <td><span>[03]</span><a>西班牙</a></td>
      <td><div class="pk"><a>4</a><a>两球半</a><a>0</a></div></td>
      <td><a>沙特阿拉伯</a><span>[02]</span></td><td class="red">3 - 0</td>
    </tr>`;
  assert.deepEqual(parseLiveMatches(html, "2026-06-22"), [{
    key: "1359210",
    matchNum: "周日037",
    home: "西班牙",
    away: "沙特阿拉伯",
    scheduledAt: "2026-06-22 00:00",
    score: { home: 3, away: 0 },
    status: "finished",
    minute: null,
    events: [],
  }]);
});

test("normalizes a TheSportsDB World Cup live event", () => {
  assert.deepEqual(normalizeTheSportsDbEvent({
    idEvent: "2391755",
    strHomeTeam: "New Zealand",
    strAwayTeam: "Egypt",
    intHomeScore: "1",
    intAwayScore: "0",
    strStatus: "1H",
    strProgress: "23",
    strTimestamp: "2026-06-22T01:00:00",
  }), {
    key: "thesportsdb-2391755",
    home: "新西兰",
    away: "埃及",
    score: { home: 1, away: 0 },
    status: "first_half",
    minute: 23,
    progressText: "上半场 23'",
    events: [],
    scheduledAt: "2026-06-22 09:00",
    sourceTimestamp: "2026-06-22T01:00:00",
  });
});

test("formats live progress by match stage and minute", () => {
  assert.equal(formatLiveProgress({ status: "finished" }), "已完成");
  assert.equal(formatLiveProgress({ status: "first_half", minute: 18 }), "上半场 18'");
  assert.equal(formatLiveProgress({ status: "halftime" }), "中场休息");
  assert.equal(formatLiveProgress({ status: "second_half", minute: 62 }), "下半场 62'");
  assert.equal(formatLiveProgress({ status: "scheduled" }), "未开始");
});
