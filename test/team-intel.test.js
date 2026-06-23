const test = require("node:test");
const assert = require("node:assert/strict");
const { buildTeamIntelligence, fetchJson } = require("../lib/team-intel");

function response(body) {
  return {
    ok: true,
    json: async () => body,
  };
}

test("retries a transient intelligence-source failure once", async () => {
  let calls = 0;
  const body = await fetchJson("https://example.test/source", async () => {
    calls += 1;
    if (calls === 1) throw new Error("fetch failed");
    return response({ ok: true });
  });
  assert.deepEqual(body, { ok: true });
  assert.equal(calls, 2);
});

test("enriches analysis facts with table records, recent form, and head to head", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes("lookuptable.php")) {
      return response({
        table: [
          { idTeam: "134509", strTeam: "Argentina", strGroup: "Group J", intRank: "1", intPlayed: "1", intWin: "1", intDraw: "0", intLoss: "0", intGoalsFor: "3", intGoalsAgainst: "0", intGoalDifference: "3", intPoints: "3", strForm: "W", strDescription: "Round of 32" },
          { idTeam: "135986", strTeam: "Austria", strGroup: "Group J", intRank: "2", intPlayed: "1", intWin: "1", intDraw: "0", intLoss: "0", intGoalsFor: "3", intGoalsAgainst: "1", intGoalDifference: "2", intPoints: "3", strForm: "W" },
        ],
      });
    }
    if (url.includes("api.fifa.com/api/v3/rankings")) {
      return response({
        Results: [
          { IdCountry: "ARG", Rank: 1, PrevRank: 3, DecimalTotalPoints: 1877.27, RankingMovementString: "2", PubDate: "2026-06-11T10:00:00+00:00", TeamName: [{ Description: "Argentina" }] },
          { IdCountry: "AUT", Rank: 24, PrevRank: 24, DecimalTotalPoints: 1597.4, RankingMovementString: "0", PubDate: "2026-06-11T10:00:00+00:00", TeamName: [{ Description: "Austria" }] },
        ],
      });
    }
    if (url.includes("eventsday.php")) return response({ events: [] });
    if (url.includes("eventslast.php?id=134509")) {
      return response({ results: [{ strLeague: "FIFA World Cup", dateEvent: "2026-06-17", strHomeTeam: "Argentina", strAwayTeam: "Algeria", intHomeScore: "3", intAwayScore: "0" }] });
    }
    if (url.includes("eventslast.php?id=135986")) {
      return response({ results: [{ strLeague: "FIFA World Cup", dateEvent: "2026-06-17", strHomeTeam: "Austria", strAwayTeam: "Jordan", intHomeScore: "3", intAwayScore: "1" }] });
    }
    if (url.includes("searchevents.php?e=Argentina_vs_Austria")) {
      return response({ event: [{ strLeague: "Friendly", dateEvent: "2022-06-01", strHomeTeam: "Argentina", strAwayTeam: "Austria", intHomeScore: "2", intAwayScore: "1" }] });
    }
    if (url.includes("searchevents.php?e=Austria_vs_Argentina")) {
      return response({ event: [] });
    }
    throw new Error(`unexpected ${url}`);
  };

  const intel = await buildTeamIntelligence([{
    key: "m1",
    home: "阿根廷",
    away: "奥地利",
    matchDate: "2026-06-23",
  }], { fetchImpl });

  assert.equal(intel.get("m1").statistics.fifaRanking.home, "FIFA第1");
  assert.equal(intel.get("m1").statistics.groupStanding.home, "Group J 第1，积3分");
  assert.equal(intel.get("m1").statistics.tournamentRecord.away, "1场 1胜0平0负，进3失1，净胜2");
  assert.deepEqual(intel.get("m1").statistics.tournamentTable[1], {
    side: "away",
    team: "奥地利",
    fifaRanking: "FIFA第24",
    groupStanding: "Group J 第2，积3分",
    played: 1,
    win: 1,
    draw: 0,
    loss: 0,
    goalsFor: 3,
    goalsAgainst: 1,
    goalDifference: 2,
    points: 3,
    form: "W",
  });
  assert.match(intel.get("m1").statistics.recentForm.home[0], /阿根廷 3-0 阿尔及利亚/);
  assert.match(intel.get("m1").statistics.headToHead[0], /阿根廷 2-1 奥地利/);
  assert.deepEqual(intel.get("m1").dataGaps, ["暂无可靠公开伤停数据，模型不得编造伤停信息。"]);
  assert.ok(calls.some((url) => url.includes("lookuptable.php")));
});

test("reports only missing pieces when head to head is unavailable", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("lookuptable.php")) return response({ table: [] });
    if (url.includes("api.fifa.com/api/v3/rankings")) return response({ Results: [] });
    if (url.includes("eventsday.php")) return response({ events: [] });
    if (url.includes("eventslast.php")) return response({ results: [] });
    if (url.includes("searchevents.php")) return response({ event: [] });
    throw new Error(`unexpected ${url}`);
  };

  const intel = await buildTeamIntelligence([{
    key: "m1",
    home: "法国",
    away: "伊拉克",
    matchDate: "2026-06-23",
  }], { fetchImpl });

  assert.equal(intel.get("m1").statistics.fifaRanking.home, "FIFA第3");
  assert.equal(intel.get("m1").statistics.groupStanding, null);
  assert.ok(intel.get("m1").dataGaps.some((gap) => gap.includes("世界杯积分榜")));
  assert.ok(intel.get("m1").dataGaps.some((gap) => gap.includes("近五年国际赛事交锋")));
});

test("uses rank-only FIFA display and limits international head to head to five years", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("lookuptable.php")) return response({ table: [] });
    if (url.includes("api.fifa.com/api/v3/rankings")) return response({ Results: [{ IdCountry: "ARG", Rank: 1, TeamName: [{ Description: "Argentina" }] }] });
    if (url.includes("eventsday.php")) return response({ events: [] });
    if (url.includes("eventslast.php")) return response({ results: [] });
    if (url.includes("searchevents.php?e=Argentina_vs_Austria")) {
      return response({ event: [
        { idEvent: "old", strLeague: "Friendly", dateEvent: "2019-06-01", strHomeTeam: "Argentina", strAwayTeam: "Austria", intHomeScore: "2", intAwayScore: "0" },
        { idEvent: "recent", strLeague: "Friendly", dateEvent: "2022-06-01", strHomeTeam: "Argentina", strAwayTeam: "Austria", intHomeScore: "2", intAwayScore: "1" },
      ] });
    }
    if (url.includes("searchevents.php?e=Austria_vs_Argentina")) return response({ event: [] });
    throw new Error(`unexpected ${url}`);
  };

  const intel = await buildTeamIntelligence([{
    key: "m1",
    home: "阿根廷",
    away: "奥地利",
    matchDate: "2026-06-23",
  }], { fetchImpl });

  assert.equal(intel.get("m1").statistics.fifaRanking.home, "FIFA第1");
  assert.deepEqual(intel.get("m1").statistics.headToHead, ["2022-06-01 Friendly 阿根廷 2-1 奥地利"]);
});

test("computes World Cup ranking from daily results when the table endpoint is truncated", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("lookuptable.php")) return response({ table: [] });
    if (url.includes("api.fifa.com/api/v3/rankings")) return response({ Results: [] });
    if (url.includes("eventsday.php?d=2026-06-17")) {
      return response({
        events: [
          { strLeague: "FIFA World Cup", strGroup: "Group J", idHomeTeam: "134509", idAwayTeam: "134516", strHomeTeam: "Argentina", strAwayTeam: "Algeria", intHomeScore: "3", intAwayScore: "0", dateEvent: "2026-06-17" },
          { strLeague: "FIFA World Cup", strGroup: "Group J", idHomeTeam: "135986", idAwayTeam: "140145", strHomeTeam: "Austria", strAwayTeam: "Jordan", intHomeScore: "3", intAwayScore: "1", dateEvent: "2026-06-17" },
        ],
      });
    }
    if (url.includes("eventsday.php")) return response({ events: [] });
    if (url.includes("eventslast.php?id=134509")) return response({ results: [] });
    if (url.includes("eventslast.php?id=135986")) return response({ results: [] });
    if (url.includes("searchevents.php")) return response({ event: [] });
    throw new Error(`unexpected ${url}`);
  };

  const intel = await buildTeamIntelligence([{
    key: "m1",
    home: "阿根廷",
    away: "奥地利",
    matchDate: "2026-06-23",
  }], { fetchImpl });

  assert.equal(intel.get("m1").statistics.groupStanding.home, "Group J 第1，积3分");
  assert.equal(intel.get("m1").statistics.groupStanding.away, "Group J 第2，积3分");
  assert.equal(intel.get("m1").statistics.tournamentRecord.home, "1场 1胜0平0负，进3失0，净胜3");
});

test("resolves current World Cup teams from the standings instead of a fixed team-id list", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("lookuptable.php")) {
      return response({ table: [
        { idTeam: "133602", strTeam: "Portugal", strGroup: "Group K", intRank: "1", intPlayed: "2", intWin: "2", intDraw: "0", intLoss: "0", intGoalsFor: "5", intGoalsAgainst: "1", intGoalDifference: "4", intPoints: "6", strForm: "WW" },
        { idTeam: "140572", strTeam: "Uzbekistan", strGroup: "Group K", intRank: "2", intPlayed: "2", intWin: "1", intDraw: "0", intLoss: "1", intGoalsFor: "2", intGoalsAgainst: "3", intGoalDifference: "-1", intPoints: "3", strForm: "WL" },
      ] });
    }
    if (url.includes("api.fifa.com/api/v3/rankings")) {
      return response({ Results: [
        { IdCountry: "POR", Rank: 7, TeamName: [{ Description: "Portugal" }] },
        { IdCountry: "UZB", Rank: 58, TeamName: [{ Description: "Uzbekistan" }] },
      ] });
    }
    if (url.includes("eventslast.php?id=133602")) return response({ results: [] });
    if (url.includes("eventslast.php?id=140572")) return response({ results: [] });
    if (url.includes("searchevents.php")) return response({ event: [] });
    if (url.includes("eventsday.php")) return response({ events: [] });
    throw new Error(`unexpected ${url}`);
  };

  const intel = await buildTeamIntelligence([{
    key: "m-current",
    home: "葡萄牙",
    away: "乌兹别克",
    matchDate: "2026-06-24",
  }], { fetchImpl });

  const stats = intel.get("m-current").statistics;
  assert.equal(stats.fifaRanking.home, "FIFA第7");
  assert.equal(stats.fifaRanking.away, "FIFA第58");
  assert.equal(stats.tournamentTable[0].played, 2);
  assert.equal(stats.tournamentTable[1].points, 3);
});

test("uses official FIFA match results when the third-party standings omit a team", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("lookuptable.php")) return response({ table: [] });
    if (url.includes("api.fifa.com/api/v3/rankings")) return response({ Results: [
      { IdCountry: "POR", Rank: 5, TeamName: [{ Description: "Portugal" }] },
      { IdCountry: "UZB", Rank: 50, TeamName: [{ Description: "Uzbekistan" }] },
    ] });
    if (url.includes("api.fifa.com/api/v3/calendar/matches")) return response({ Results: [
      { IdCompetition: "17", Date: "2026-06-17T16:00:00Z", GroupName: [{ Description: "Group K" }], Home: { IdTeam: "p", Score: 2, TeamName: [{ Description: "Portugal" }] }, Away: { IdTeam: "x", Score: 0, TeamName: [{ Description: "Uzbekistan" }] } },
    ] });
    if (url.includes("eventslast.php")) return response({ results: [] });
    if (url.includes("searchevents.php")) return response({ event: [] });
    if (url.includes("eventsday.php")) return response({ events: [] });
    throw new Error(`unexpected ${url}`);
  };

  const intel = await buildTeamIntelligence([{
    key: "m-fifa",
    home: "葡萄牙",
    away: "乌兹别克",
    matchDate: "2026-06-24",
  }], { fetchImpl });

  const stats = intel.get("m-fifa").statistics;
  assert.equal(stats.tournamentTable[0].played, 1);
  assert.equal(stats.tournamentTable[0].points, 3);
  assert.equal(stats.tournamentTable[1].played, 1);
});
