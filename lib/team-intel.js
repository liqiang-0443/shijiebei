const WORLD_CUP_LEAGUE_ID = "4429";
const WORLD_CUP_SEASON = "2026";
const SPORTS_DB_API = "https://www.thesportsdb.com/api/v1/json/3";
const WORLD_CUP_START_DATE = "2026-06-11";

const TEAM_ALIASES = {
  "阿根廷": "Argentina",
  "奥地利": "Austria",
  "法国": "France",
  "伊拉克": "Iraq",
  "挪威": "Norway",
  "塞内加尔": "Senegal",
  "约旦": "Jordan",
  "阿尔及利亚": "Algeria",
};

const TEAM_IDS = {
  Argentina: "134509",
  Austria: "135986",
  France: "133913",
  Iraq: "140148",
  Norway: "136516",
  Senegal: "136143",
  Jordan: "140145",
  Algeria: "134516",
};

const ZH_TEAM_NAMES = Object.fromEntries(Object.entries(TEAM_ALIASES).map(([zh, en]) => [en, zh]));
let nextSourceFetchAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toEnglishTeamName(name) {
  return TEAM_ALIASES[name] || name;
}

function toChineseTeamName(name) {
  return ZH_TEAM_NAMES[name] || name;
}

async function fetchJson(url, fetchImpl) {
  if (fetchImpl === fetch) {
    const waitMs = Math.max(0, nextSourceFetchAt - Date.now());
    if (waitMs) await sleep(waitMs);
    nextSourceFetchAt = Date.now() + 350;
  }
  const response = await fetchImpl(url, {
    headers: { "User-Agent": "WorldCupOddsPoc/1.0" },
  });
  if (!response.ok) throw new Error(`team intel source returned ${response.status}`);
  return response.json();
}

function normalizeTableRow(row) {
  const played = Number(row.intPlayed) || 0;
  const win = Number(row.intWin) || 0;
  const draw = Number(row.intDraw) || 0;
  const loss = Number(row.intLoss) || 0;
  const goalsFor = Number(row.intGoalsFor) || 0;
  const goalsAgainst = Number(row.intGoalsAgainst) || 0;
  const goalDifference = Number(row.intGoalDifference) || goalsFor - goalsAgainst;
  const points = Number(row.intPoints) || 0;
  const group = row.strGroup || "小组";
  return {
    teamId: row.idTeam,
    team: row.strTeam,
    ranking: `${group} 第${row.intRank || "-"}，积${points}分`,
    record: `${played}场 ${win}胜${draw}平${loss}负，进${goalsFor}失${goalsAgainst}，净胜${goalDifference}`,
    form: row.strForm || "",
    status: row.strDescription || "",
    updatedAt: row.dateUpdated || "",
  };
}

function eventHasScore(event) {
  return event.intHomeScore !== null && event.intHomeScore !== undefined
    && event.intAwayScore !== null && event.intAwayScore !== undefined;
}

function formatEvent(event) {
  const home = toChineseTeamName(event.strHomeTeam || "");
  const away = toChineseTeamName(event.strAwayTeam || "");
  const homeScore = event.intHomeScore ?? "-";
  const awayScore = event.intAwayScore ?? "-";
  const league = event.strLeague ? ` ${event.strLeague}` : "";
  return `${event.dateEvent || ""}${league} ${home} ${homeScore}-${awayScore} ${away}`.trim();
}

function tableByTeamName(rows) {
  const out = new Map();
  for (const row of rows || []) {
    if (row?.strTeam) out.set(row.strTeam, normalizeTableRow(row));
  }
  return out;
}

function addDays(date, days) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function dateRange(start, end) {
  const dates = [];
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  return dates;
}

async function fetchWorldCupTable(fetchImpl) {
  const url = `${SPORTS_DB_API}/lookuptable.php?l=${WORLD_CUP_LEAGUE_ID}&s=${WORLD_CUP_SEASON}`;
  const body = await fetchJson(url, fetchImpl);
  return tableByTeamName(body.table || []);
}

function ensureStanding(groupMap, group, teamId, team) {
  if (!groupMap.has(group)) groupMap.set(group, new Map());
  const teams = groupMap.get(group);
  if (!teams.has(teamId)) {
    teams.set(teamId, {
      idTeam: teamId,
      strTeam: team,
      strGroup: group,
      intPlayed: 0,
      intWin: 0,
      intDraw: 0,
      intLoss: 0,
      intGoalsFor: 0,
      intGoalsAgainst: 0,
      intGoalDifference: 0,
      intPoints: 0,
      strForm: "",
    });
  }
  return teams.get(teamId);
}

function applyResult(row, goalsFor, goalsAgainst) {
  row.intPlayed += 1;
  row.intGoalsFor += goalsFor;
  row.intGoalsAgainst += goalsAgainst;
  row.intGoalDifference = row.intGoalsFor - row.intGoalsAgainst;
  if (goalsFor > goalsAgainst) {
    row.intWin += 1;
    row.intPoints += 3;
    row.strForm += "W";
  } else if (goalsFor === goalsAgainst) {
    row.intDraw += 1;
    row.intPoints += 1;
    row.strForm += "D";
  } else {
    row.intLoss += 1;
    row.strForm += "L";
  }
}

function computeStandings(events) {
  const byGroup = new Map();
  for (const event of events) {
    if (event.strLeague !== "FIFA World Cup" || !eventHasScore(event) || !event.strGroup) continue;
    const homeScore = Number(event.intHomeScore);
    const awayScore = Number(event.intAwayScore);
    const home = ensureStanding(byGroup, event.strGroup, event.idHomeTeam, event.strHomeTeam);
    const away = ensureStanding(byGroup, event.strGroup, event.idAwayTeam, event.strAwayTeam);
    applyResult(home, homeScore, awayScore);
    applyResult(away, awayScore, homeScore);
  }
  const rows = [];
  for (const teams of byGroup.values()) {
    const ranked = [...teams.values()].sort((a, b) => (
      b.intPoints - a.intPoints
      || b.intGoalDifference - a.intGoalDifference
      || b.intGoalsFor - a.intGoalsFor
      || String(a.strTeam).localeCompare(String(b.strTeam))
    ));
    ranked.forEach((row, index) => {
      rows.push({ ...row, intRank: index + 1 });
    });
  }
  return tableByTeamName(rows);
}

function eventIncludesTeam(event, teamId) {
  return event.idHomeTeam === teamId || event.idAwayTeam === teamId;
}

function teamEventsFromPool(events, teamId) {
  if (!teamId) return [];
  return events
    .filter((event) => eventHasScore(event) && eventIncludesTeam(event, teamId))
    .sort((a, b) => String(b.dateEvent).localeCompare(String(a.dateEvent)))
    .slice(0, 5);
}

async function fetchWorldCupEventsThrough(date, fetchImpl) {
  const events = [];
  const dates = dateRange(WORLD_CUP_START_DATE, date);
  for (const sourceDate of dates) {
    const url = `${SPORTS_DB_API}/eventsday.php?d=${sourceDate}&s=Soccer`;
    const body = await fetchJson(url, fetchImpl);
    events.push(...(body.events || []).filter((event) => event.strLeague === "FIFA World Cup"));
  }
  return events;
}

async function fetchRecentEvents(teamId, fetchImpl) {
  if (!teamId) return [];
  const url = `${SPORTS_DB_API}/eventslast.php?id=${teamId}`;
  const body = await fetchJson(url, fetchImpl);
  return (body.results || [])
    .filter(eventHasScore)
    .slice(0, 5);
}

function formatRecentResults(events) {
  return events.map(formatEvent);
}

async function fetchHeadToHead(homeEn, awayEn, matchDate, fetchImpl) {
  const queries = [`${homeEn}_vs_${awayEn}`, `${awayEn}_vs_${homeEn}`];
  const events = [];
  for (const query of queries) {
    const url = `${SPORTS_DB_API}/searchevents.php?e=${encodeURIComponent(query)}`;
    const body = await fetchJson(url, fetchImpl);
    events.push(...(body.event || []));
  }
  const seen = new Set();
  return events
    .filter((event) => eventHasScore(event) && (!matchDate || event.dateEvent < matchDate))
    .filter((event) => {
      if (seen.has(event.idEvent)) return false;
      seen.add(event.idEvent);
      return true;
    })
    .sort((a, b) => String(b.dateEvent).localeCompare(String(a.dateEvent)))
    .slice(0, 5)
    .map(formatEvent);
}

function pairStatistics(homeRow, awayRow, homeRecent, awayRecent, headToHead) {
  const stats = {
    worldCupRanking: homeRow && awayRow ? {
      home: homeRow.ranking,
      away: awayRow.ranking,
    } : null,
    tournamentRecord: homeRow && awayRow ? {
      home: homeRow.record,
      away: awayRow.record,
      homeForm: homeRow.form,
      awayForm: awayRow.form,
    } : null,
    recentForm: {
      home: homeRecent,
      away: awayRecent,
    },
    headToHead: headToHead.length ? headToHead : null,
  };
  const dataGaps = [];
  if (!stats.worldCupRanking || !stats.tournamentRecord) dataGaps.push("世界杯积分榜/本届战绩未匹配到完整球队数据。");
  if (!homeRecent.length || !awayRecent.length) dataGaps.push("近期赛果数据不完整。");
  if (!stats.headToHead) dataGaps.push("公开源未找到双方历史交锋赛果。");
  return { statistics: stats, dataGaps };
}

async function buildTeamIntelligence(matches, { fetchImpl = fetch } = {}) {
  const table = await fetchWorldCupTable(fetchImpl).catch(() => new Map());
  const teamNames = [...new Set(matches.flatMap((match) => [
    toEnglishTeamName(match.home),
    toEnglishTeamName(match.away),
  ]))];
  const missingFromTable = teamNames.some((name) => !table.has(name));
  let worldCupEvents = [];
  const recentEventsByName = new Map();
  for (const name of teamNames) {
    const events = await fetchRecentEvents(TEAM_IDS[name] || table.get(name)?.teamId, fetchImpl).catch(() => []);
    recentEventsByName.set(name, events);
  }
  let supplementalWorldCupEvents = [
    ...worldCupEvents,
    ...[...recentEventsByName.values()].flat().filter((event) => event.strLeague === "FIFA World Cup"),
  ];
  if (supplementalWorldCupEvents.length) {
    const recentComputed = computeStandings(supplementalWorldCupEvents);
    for (const name of teamNames) {
      if (recentComputed.has(name)) table.set(name, recentComputed.get(name));
    }
  }
  if (teamNames.some((name) => !table.has(name))) {
    const maxDate = matches.map((match) => match.matchDate).filter(Boolean).sort().at(-1) || WORLD_CUP_START_DATE;
    worldCupEvents = await fetchWorldCupEventsThrough(maxDate, fetchImpl).catch(() => []);
    supplementalWorldCupEvents = [
      ...worldCupEvents,
      ...[...recentEventsByName.values()].flat().filter((event) => event.strLeague === "FIFA World Cup"),
    ];
    const computed = computeStandings(supplementalWorldCupEvents);
    for (const name of teamNames) {
      if (computed.has(name)) table.set(name, computed.get(name));
    }
  }
  const out = new Map();
  for (const match of matches) {
    const homeEn = toEnglishTeamName(match.home);
    const awayEn = toEnglishTeamName(match.away);
    const headToHead = missingFromTable ? [] : await fetchHeadToHead(homeEn, awayEn, match.matchDate, fetchImpl).catch(() => []);
    const homeRecentEvents = teamEventsFromPool(supplementalWorldCupEvents, TEAM_IDS[homeEn] || table.get(homeEn)?.teamId);
    const awayRecentEvents = teamEventsFromPool(supplementalWorldCupEvents, TEAM_IDS[awayEn] || table.get(awayEn)?.teamId);
    const homeRecent = formatRecentResults(homeRecentEvents.length ? homeRecentEvents : (recentEventsByName.get(homeEn) || []));
    const awayRecent = formatRecentResults(awayRecentEvents.length ? awayRecentEvents : (recentEventsByName.get(awayEn) || []));
    out.set(match.key, pairStatistics(
      table.get(homeEn),
      table.get(awayEn),
      homeRecent,
      awayRecent,
      headToHead,
    ));
  }
  return out;
}

module.exports = {
  WORLD_CUP_LEAGUE_ID,
  buildTeamIntelligence,
  toEnglishTeamName,
};
