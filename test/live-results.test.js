const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeLiveMatch,
  livePayload,
  parseLiveMatches,
  normalizeTheSportsDbEvent,
  formatLiveProgress,
  worldCupEventsForChinaDate,
  parse500LiveMatches,
  normalizeFifaLiveMatch,
  fifaEventsForChinaDate,
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

test("keeps only World Cup events whose source time is Beijing today", () => {
  const matches = worldCupEventsForChinaDate([
    { idEvent: "yesterday", strLeague: "FIFA World Cup", strTimestamp: "2026-06-21T00:00:00" },
    { idEvent: "today", strLeague: "FIFA World Cup", strTimestamp: "2026-06-21T19:00:00" },
    { idEvent: "other", strLeague: "Friendly", strTimestamp: "2026-06-22T01:00:00" },
  ], "2026-06-22");

  assert.deepEqual(matches.map((event) => event.idEvent), ["today"]);
});

test("parses the official score page by its displayed Beijing kickoff date", () => {
  const html = `
    <tr id="a1359210" gy="世界杯,西班牙,沙特" lid="110">
      <td>世界杯</td><td>第2轮</td><td>06-22 00:00</td><td><span>完</span></td>
      <td><span>[03]</span><a><span>西班牙</span></a></td>
      <td><div class="pk"><a>4</a><a>两球半/三球</a><a>0</a></div></td>
      <td><a><span>沙特</span></a><span>[02]</span></td><td class="red">3 - 0</td>
    </tr>
    <tr id="a1359211" gy="世界杯,昨天队,另一队" lid="110">
      <td>世界杯</td><td>第2轮</td><td>06-21 12:00</td><td><span>完</span></td>
      <td><a>昨天队</a></td><td></td><td><a>另一队</a></td><td>1 - 0</td>
    </tr>`;

  assert.deepEqual(parse500LiveMatches(html, "2026-06-22"), [{
    key: "500-1359210",
    home: "西班牙",
    away: "沙特",
    score: { home: 3, away: 0 },
    status: "finished",
    minute: null,
    events: [],
    matchNum: "",
    scheduledAt: "2026-06-22 00:00",
  }]);
});

test("uses FIFA official World Cup scores for the Beijing matchday", () => {
  const event = {
    IdCompetition: "17",
    IdMatch: "400021483",
    Date: "2026-06-21T16:00:00Z",
    MatchStatus: 0,
    Home: { Score: 4, TeamName: [{ Description: "Spain" }] },
    Away: { Score: 0, TeamName: [{ Description: "Saudi Arabia" }] },
  };

  assert.deepEqual(fifaEventsForChinaDate([event], "2026-06-22"), [event]);
  assert.deepEqual(normalizeFifaLiveMatch(event), {
    key: "fifa-400021483",
    home: "西班牙",
    away: "沙特",
    score: { home: 4, away: 0 },
    status: "finished",
    minute: null,
    progressText: "已完成",
    events: [],
    scheduledAt: "2026-06-22 00:00",
    sourceTimestamp: "2026-06-21T16:00:00Z",
  });
});

test("reports a live FIFA match with its current half and minute", () => {
  const match = normalizeFifaLiveMatch({
    IdMatch: "live-1",
    Date: "2026-06-22T01:00:00Z",
    MatchStatus: 2,
    MatchTime: "63'",
    Home: { Score: 1, TeamName: [{ Description: "Spain" }] },
    Away: { Score: 0, TeamName: [{ Description: "Saudi Arabia" }] },
  });

  assert.equal(match.status, "second_half");
  assert.equal(match.minute, 63);
  assert.equal(match.progressText, "下半场 63'");
});
