const WORLD_CUP_LEAGUE_ID = "4429";
const WORLD_CUP_SEASON = "2026";
const SPORTS_DB_API = "https://www.thesportsdb.com/api/v1/json/3";
const FIFA_API = "https://api.fifa.com/api/v3";
const WORLD_CUP_START_DATE = "2026-06-11";
const SOURCE_TIMEOUT_MS = 8000;

const TEAM_ALIASES = {
  "阿根廷": "Argentina",
  "奥地利": "Austria",
  "法国": "France",
  "伊拉克": "Iraq",
  "挪威": "Norway",
  "塞内加尔": "Senegal",
  "约旦": "Jordan",
  "阿尔及利亚": "Algeria",
  "葡萄牙": "Portugal",
  "乌兹别克": "Uzbekistan",
  "英格兰": "England",
  "加纳": "Ghana",
  "巴拿马": "Panama",
  "克罗地亚": "Croatia",
  "哥伦比亚": "Colombia",
  "刚果(金)": "DR Congo",
  "刚果民主共和国": "DR Congo",
  "刚果（金）": "Congo DR",
  "摩洛哥": "Morocco",
  "海地": "Haiti",
  "苏格兰": "Scotland",
  "巴西": "Brazil",
  "瑞士": "Switzerland",
  "加拿大": "Canada",
  "墨西哥": "Mexico",
  "南非": "South Africa",
  "韩国": "South Korea",
  "美国": "USA",
  "日本": "Japan",
  "西班牙": "Spain",
  "德国": "Germany",
  "荷兰": "Netherlands",
  "比利时": "Belgium",
  "乌拉圭": "Uruguay",
  "厄瓜多尔": "Ecuador",
  "巴拉圭": "Paraguay",
  "卡塔尔": "Qatar",
  "沙特阿拉伯": "Saudi Arabia",
  "突尼斯": "Tunisia",
  "科特迪瓦": "Ivory Coast",
  "澳大利亚": "Australia",
  "新西兰": "New Zealand",
  "伊朗": "Iran",
  "佛得角": "Cape Verde",
  "库拉索": "Curacao",
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

const COUNTRY_CODES = {
  Argentina: "ARG",
  Austria: "AUT",
  France: "FRA",
  Iraq: "IRQ",
  Norway: "NOR",
  Senegal: "SEN",
  Jordan: "JOR",
  Algeria: "ALG",
};

const FIFA_RANKING_FALLBACK = {
  ARG: { rank: 1, previousRank: 3, points: 1877.27, movement: 2, publishedAt: "2026-06-11T10:00:00+00:00" },
  AUT: { rank: 24, previousRank: 24, points: 1597.40, movement: 0, publishedAt: "2026-06-11T10:00:00+00:00" },
  FRA: { rank: 3, previousRank: 1, points: 1870.70, movement: -2, publishedAt: "2026-06-11T10:00:00+00:00" },
  IRQ: { rank: 57, previousRank: 57, points: 1446.28, movement: 0, publishedAt: "2026-06-11T10:00:00+00:00" },
  NOR: { rank: 31, previousRank: 31, points: 1557.44, movement: 0, publishedAt: "2026-06-11T10:00:00+00:00" },
  SEN: { rank: 15, previousRank: 14, points: 1684.07, movement: -1, publishedAt: "2026-06-11T10:00:00+00:00" },
  JOR: { rank: 63, previousRank: 63, points: 1387.74, movement: 0, publishedAt: "2026-06-11T10:00:00+00:00" },
  ALG: { rank: 28, previousRank: 28, points: 1571.03, movement: 0, publishedAt: "2026-06-11T10:00:00+00:00" },
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
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (fetchImpl === fetch) {
      const waitMs = Math.max(0, nextSourceFetchAt - Date.now());
      if (waitMs) await sleep(waitMs);
      nextSourceFetchAt = Date.now() + 350;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, {
        headers: { "User-Agent": "WorldCupOddsPoc/1.0" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`team intel source returned ${response.status}`);
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt === 0 && fetchImpl === fetch) await sleep(500);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
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
    group,
    rank: Number(row.intRank) || null,
    played,
    win,
    draw,
    loss,
    goalsFor,
    goalsAgainst,
    goalDifference,
    points,
    form: row.strForm || "",
    status: row.strDescription || "",
    updatedAt: row.dateUpdated || "",
  };
}

function normalizeFifaRankingRow(row) {
  return {
    countryCode: row.IdCountry,
    team: row.TeamName?.[0]?.Description || row.IdCountry,
    rank: Number(row.Rank) || null,
    previousRank: Number(row.PrevRank) || null,
    points: Number(row.DecimalTotalPoints) || Number(row.TotalPoints) || null,
    movement: Number(row.RankingMovementString ?? row.RankingMovement) || 0,
    publishedAt: row.PubDate || null,
  };
}

function fallbackFifaRankings() {
  return new Map(Object.entries(FIFA_RANKING_FALLBACK));
}

async function fetchFifaRankings(fetchImpl) {
  const url = `${FIFA_API}/rankings/?gender=1&count=250&language=en`;
  const body = await fetchJson(url, fetchImpl);
  const rankings = fallbackFifaRankings();
  for (const row of body.Results || []) {
    if (row.IdCountry) rankings.set(row.IdCountry, normalizeFifaRankingRow(row));
  }
  return rankings;
}

function formatFifaRanking(row) {
  if (!row?.rank) return "暂无";
  return `FIFA第${row.rank}`;
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

function fifaRankingByTeamName(rankings) {
  const out = new Map();
  for (const [countryCode, row] of rankings) {
    if (row?.team) out.set(row.team, row);
    for (const [team, code] of Object.entries(COUNTRY_CODES)) {
      if (code === countryCode && !out.has(team)) out.set(team, row);
    }
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

function eventIncludesTeamName(event, teamName) {
  return event.strHomeTeam === teamName || event.strAwayTeam === teamName;
}

function teamEventsFromPool(events, teamId, teamName) {
  if (!teamId && !teamName) return [];
  return events
    .filter((event) => eventHasScore(event) && (
      eventIncludesTeam(event, teamId) || eventIncludesTeamName(event, teamName)
    ))
    .sort((a, b) => String(b.dateEvent).localeCompare(String(a.dateEvent)))
    .slice(0, 5);
}

function fifaMatchTeamName(team) {
  return team?.TeamName?.[0]?.Description || team?.ShortClubName || "";
}

async function fetchFifaWorldCupEventsThrough(date, fetchImpl) {
  const url = `${FIFA_API}/calendar/matches?idCompetition=17&from=${WORLD_CUP_START_DATE}&to=${date}&language=en&count=500`;
  const body = await fetchJson(url, fetchImpl);
  return (body.Results || []).map((event) => ({
    strLeague: "FIFA World Cup",
    strGroup: event.GroupName?.[0]?.Description || "",
    idHomeTeam: event.Home?.IdTeam || "",
    idAwayTeam: event.Away?.IdTeam || "",
    strHomeTeam: fifaMatchTeamName(event.Home),
    strAwayTeam: fifaMatchTeamName(event.Away),
    intHomeScore: event.Home?.Score,
    intAwayScore: event.Away?.Score,
    dateEvent: String(event.Date || "").slice(0, 10),
  }));
}

async function fetchWorldCupEventsThrough(date, fetchImpl) {
  const dates = dateRange(WORLD_CUP_START_DATE, date);
  const payloads = await Promise.all(dates.map(async (sourceDate) => {
    const url = `${SPORTS_DB_API}/eventsday.php?d=${sourceDate}&s=Soccer`;
    const body = await fetchJson(url, fetchImpl);
    return (body.events || []).filter((event) => event.strLeague === "FIFA World Cup");
  }));
  return payloads.flat();
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
  const payloads = await Promise.all(queries.map(async (query) => {
    const url = `${SPORTS_DB_API}/searchevents.php?e=${encodeURIComponent(query)}`;
    const body = await fetchJson(url, fetchImpl);
    return body.event || [];
  }));
  const events = payloads.flat();
  const seen = new Set();
  const cutoff = matchDate ? addDays(matchDate, -365 * 5) : "";
  return events
    .filter((event) => eventHasScore(event) && (!matchDate || event.dateEvent < matchDate))
    .filter((event) => !cutoff || event.dateEvent >= cutoff)
    .filter((event) => {
      if (seen.has(event.idEvent)) return false;
      seen.add(event.idEvent);
      return true;
    })
    .sort((a, b) => String(b.dateEvent).localeCompare(String(a.dateEvent)))
    .slice(0, 5)
    .map(formatEvent);
}

function tournamentTableRow(side, name, fifaRow, groupRow) {
  return {
    side,
    team: toChineseTeamName(name),
    fifaRanking: formatFifaRanking(fifaRow),
    groupStanding: groupRow?.ranking || "暂无",
    played: groupRow?.played ?? 0,
    win: groupRow?.win ?? 0,
    draw: groupRow?.draw ?? 0,
    loss: groupRow?.loss ?? 0,
    goalsFor: groupRow?.goalsFor ?? 0,
    goalsAgainst: groupRow?.goalsAgainst ?? 0,
    goalDifference: groupRow?.goalDifference ?? 0,
    points: groupRow?.points ?? 0,
    form: groupRow?.form || "",
  };
}

function pairStatistics(homeName, awayName, homeRow, awayRow, homeFifa, awayFifa, homeRecent, awayRecent, headToHead, lineupStatus) {
  const stats = {
    fifaRanking: {
      home: formatFifaRanking(homeFifa),
      away: formatFifaRanking(awayFifa),
      updatedAt: homeFifa?.publishedAt || awayFifa?.publishedAt || null,
    },
    groupStanding: homeRow && awayRow ? {
      home: homeRow.ranking,
      away: awayRow.ranking,
    } : null,
    tournamentRecord: homeRow && awayRow ? {
      home: homeRow.record,
      away: awayRow.record,
      homeForm: homeRow.form,
      awayForm: awayRow.form,
    } : null,
    tournamentTable: [
      tournamentTableRow("home", homeName, homeFifa, homeRow),
      tournamentTableRow("away", awayName, awayFifa, awayRow),
    ],
    recentForm: {
      home: homeRecent,
      away: awayRecent,
    },
    headToHead: headToHead.length ? headToHead : null,
    injuries: null,
    lineupStatus,
  };
  const dataGaps = [];
  if (!homeFifa || !awayFifa) dataGaps.push("FIFA全球排名未匹配到完整球队数据。");
  if (!stats.groupStanding || !stats.tournamentRecord) dataGaps.push("世界杯积分榜/本届战绩未匹配到完整球队数据。");
  if (!homeRecent.length || !awayRecent.length) dataGaps.push("近期赛果数据不完整。");
  if (!stats.headToHead) dataGaps.push("公开源未找到双方近五年国际赛事交锋赛果。");
  dataGaps.push("暂无可靠公开伤停数据，模型不得编造伤停信息。");
  return { statistics: stats, dataGaps };
}

async function buildTeamIntelligence(matches, { fetchImpl = fetch } = {}) {
  const table = await fetchWorldCupTable(fetchImpl).catch(() => new Map());
  const fifaRankings = await fetchFifaRankings(fetchImpl).catch(fallbackFifaRankings);
  const fifaRankingsByTeam = fifaRankingByTeamName(fifaRankings);
  const teamNames = [...new Set(matches.flatMap((match) => [
    toEnglishTeamName(match.home),
    toEnglishTeamName(match.away),
  ]))];
  const maxDate = matches.map((match) => match.matchDate).filter(Boolean).sort().at(-1) || WORLD_CUP_START_DATE;
  let worldCupEvents = await fetchFifaWorldCupEventsThrough(maxDate, fetchImpl).catch(() => []);
  const recentEventEntries = await Promise.all(teamNames.map(async (name) => {
    const events = await fetchRecentEvents(TEAM_IDS[name] || table.get(name)?.teamId, fetchImpl).catch(() => []);
    return [name, events];
  }));
  const recentEventsByName = new Map(recentEventEntries);
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
  // Recent team events already contain the current tournament results in normal operation.
  // Only scan each matchday when a team is still missing after that cheaper source.
  if (teamNames.some((name) => !table.has(name))) {
    const sportsDbEvents = await fetchWorldCupEventsThrough(maxDate, fetchImpl).catch(() => []);
    supplementalWorldCupEvents = [
      ...worldCupEvents,
      ...sportsDbEvents,
      ...[...recentEventsByName.values()].flat().filter((event) => event.strLeague === "FIFA World Cup"),
    ];
    const computed = computeStandings(supplementalWorldCupEvents);
    for (const name of teamNames) {
      if (computed.has(name)) table.set(name, computed.get(name));
    }
  }
  const intelligence = await Promise.all(matches.map(async (match) => {
    const homeEn = toEnglishTeamName(match.home);
    const awayEn = toEnglishTeamName(match.away);
    const homeFifa = fifaRankingsByTeam.get(homeEn) || fifaRankings.get(COUNTRY_CODES[homeEn]);
    const awayFifa = fifaRankingsByTeam.get(awayEn) || fifaRankings.get(COUNTRY_CODES[awayEn]);
    const headToHead = await fetchHeadToHead(homeEn, awayEn, match.matchDate, fetchImpl).catch(() => []);
    const homeRecentEvents = teamEventsFromPool(supplementalWorldCupEvents, TEAM_IDS[homeEn] || table.get(homeEn)?.teamId, homeEn);
    const awayRecentEvents = teamEventsFromPool(supplementalWorldCupEvents, TEAM_IDS[awayEn] || table.get(awayEn)?.teamId, awayEn);
    const homeRecent = formatRecentResults(homeRecentEvents.length ? homeRecentEvents : (recentEventsByName.get(homeEn) || []));
    const awayRecent = formatRecentResults(awayRecentEvents.length ? awayRecentEvents : (recentEventsByName.get(awayEn) || []));
    return [match.key, pairStatistics(
      homeEn,
      awayEn,
      table.get(homeEn),
      table.get(awayEn),
      homeFifa,
      awayFifa,
      homeRecent,
      awayRecent,
      headToHead,
      "赛前首发尚未公布；公开伤停源未提供可信数据。",
    )];
  }));
  return new Map(intelligence);
}

module.exports = {
  WORLD_CUP_LEAGUE_ID,
  buildTeamIntelligence,
  fetchJson,
  toEnglishTeamName,
};
