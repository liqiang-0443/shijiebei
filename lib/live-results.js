const statusMap = {
  "未开赛": "scheduled",
  "未": "scheduled",
  "上半场": "first_half",
  "上半": "first_half",
  "中场": "halftime",
  "中": "halftime",
  "下半场": "second_half",
  "下半": "second_half",
  "完场": "finished",
  "完": "finished",
  "延期": "postponed",
  "进行中": "first_half",
};

const sportsDbStatusMap = {
  NS: "scheduled",
  "1H": "first_half",
  HT: "halftime",
  "2H": "second_half",
  FT: "finished",
  AET: "finished",
  PEN: "finished",
  PST: "postponed",
  CANC: "postponed",
};

const teamNameMap = {
  Argentina: "阿根廷",
  Austria: "奥地利",
  France: "法国",
  Iraq: "伊拉克",
  Norway: "挪威",
  Senegal: "塞内加尔",
  Jordan: "约旦",
  Algeria: "阿尔及利亚",
  Belgium: "比利时",
  Iran: "伊朗",
  "New Zealand": "新西兰",
  Egypt: "埃及",
  Spain: "西班牙",
  "Saudi Arabia": "沙特",
  Uruguay: "乌拉圭",
  "Cabo Verde": "佛得角",
  "IR Iran": "伊朗",
  England: "英格兰",
  Ghana: "加纳",
  Ecuador: "厄瓜多尔",
  "Curaçao": "库拉索",
  Curacao: "库拉索",
  Tunisia: "突尼斯",
  Japan: "日本",
};

const progressLabels = {
  scheduled: "未开始",
  first_half: "上半场",
  halftime: "中场休息",
  second_half: "下半场",
  live: "进行中",
  finished: "已完成",
  postponed: "延期",
};

function zhTeam(name) {
  return teamNameMap[name] || name;
}

function chinaDateTime(value) {
  if (!value) return "";
  const raw = String(value);
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(raw) ? raw : `${raw}Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

function progressMinute(event) {
  const raw = event.strProgress ?? event.intProgress ?? event.strMinute ?? event.intMinute ?? event.minute;
  const match = String(raw || "").match(/\d{1,3}/);
  return match ? Number(match[0]) : null;
}

function formatLiveProgress(match) {
  const label = progressLabels[match.status] || "未开始";
  if ((match.status === "first_half" || match.status === "second_half") && match.minute) {
    return `${label} ${match.minute}'`;
  }
  return label;
}

function normalizeLiveMatch(raw) {
  return {
    key: String(raw.id),
    home: String(raw.home),
    away: String(raw.away),
    score: {
      home: Number(raw.homeScore) || 0,
      away: Number(raw.awayScore) || 0,
    },
    status: statusMap[raw.status] || "scheduled",
    minute: Number.isFinite(Number(raw.minute)) ? Number(raw.minute) : null,
    events: Array.isArray(raw.events) ? raw.events : [],
  };
}

function livePayload(matches, updatedAt, error = null) {
  return {
    ok: !error,
    stale: Boolean(error),
    updatedAt,
    error,
    matches,
  };
}

function stripTags(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTeam(cellHtml) {
  const links = [...String(cellHtml || "").matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)];
  return stripTags(links[0]?.[1] || "");
}

function parseScore(value) {
  const match = String(value || "").match(/(\d+)\s*-\s*(\d+)/);
  return match ? { home: Number(match[1]), away: Number(match[2]) } : { home: 0, away: 0 };
}

function parseLiveMatches(html, chinaDate) {
  const matches = [];
  const rows = String(html || "").matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/g);
  for (const row of rows) {
    const id = row[1].match(/\bfid="([^"]+)"/)?.[1] || row[1].match(/\bid="a([^"]+)"/)?.[1];
    const cells = [...row[2].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => cell[1]);
    if (!id || cells.length < 9 || !stripTags(cells[1]).includes("世界杯")) continue;
    const [monthDay, time = ""] = stripTags(cells[3]).split(" ");
    if (monthDay !== String(chinaDate || "").slice(5)) continue;
    const statusText = stripTags(cells[4]);
    const minute = statusText.match(/(\d{1,3})\s*['']/)?.[1];
    const match = normalizeLiveMatch({
      id,
      home: getTeam(cells[5]),
      away: getTeam(cells[7]),
      homeScore: parseScore(stripTags(cells[8])).home,
      awayScore: parseScore(stripTags(cells[8])).away,
      status: statusText,
      minute,
    });
    matches.push({
      ...match,
      matchNum: stripTags(cells[0]),
      scheduledAt: `${chinaDate} ${time}`,
    });
  }
  return matches;
}

function parse500LiveMatches(html, chinaDate) {
  const matches = [];
  const rows = String(html || "").matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/g);
  for (const row of rows) {
    const id = row[1].match(/\bid="a([^\"]+)"/)?.[1];
    const leagueId = row[1].match(/\blid="([^\"]+)"/)?.[1];
    if (!id || leagueId !== "110") continue;
    const cells = [...row[2].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => cell[1]);
    if (cells.length < 8) continue;
    const [monthDay, time = ""] = stripTags(cells[2]).split(" ");
    if (monthDay !== String(chinaDate || "").slice(5)) continue;
    const statusText = stripTags(cells[3]);
    const score = parseScore(stripTags(cells[7]));
    const match = normalizeLiveMatch({
      id: `500-${id}`,
      home: getTeam(cells[4]),
      away: getTeam(cells[6]),
      homeScore: score.home,
      awayScore: score.away,
      status: statusText,
      minute: statusText,
    });
    matches.push({
      ...match,
      matchNum: "",
      scheduledAt: `${chinaDate} ${time}`,
    });
  }
  return matches;
}

function normalizeTheSportsDbEvent(event) {
  const status = sportsDbStatusMap[event.strStatus] || "scheduled";
  const minute = progressMinute(event);
  const match = {
    status,
    minute,
  };
  return {
    key: `thesportsdb-${event.idEvent}`,
    home: zhTeam(String(event.strHomeTeam || "")),
    away: zhTeam(String(event.strAwayTeam || "")),
    score: {
      home: Number(event.intHomeScore) || 0,
      away: Number(event.intAwayScore) || 0,
    },
    status,
    minute,
    progressText: formatLiveProgress(match),
    events: [],
    scheduledAt: chinaDateTime(event.strTimestamp),
    sourceTimestamp: String(event.strTimestamp || ""),
  };
}

function worldCupEventsForChinaDate(events, chinaDate) {
  return (events || []).filter((event) => {
    if (event.strLeague !== "FIFA World Cup" || !event.strTimestamp) return false;
    return chinaDateTime(event.strTimestamp).slice(0, 10) === chinaDate;
  });
}

function fifaEventsForChinaDate(events, chinaDate) {
  return (events || []).filter((event) => (
    String(event.IdCompetition) === "17"
    && chinaDateTime(event.Date).slice(0, 10) === chinaDate
  ));
}

function fifaTeamName(side) {
  return side?.TeamName?.[0]?.Description || side?.ShortClubName || "";
}

function normalizeFifaLiveMatch(event) {
  const matchTime = String(event.MatchTime || "");
  const minute = Number(matchTime.match(/\d{1,3}/)?.[0]) || null;
  let status = "live";
  if (Number(event.MatchStatus) === 0) status = "finished";
  else if (Number(event.MatchStatus) === 1) status = "scheduled";
  else if (minute) status = minute <= 45 ? "first_half" : "second_half";
  else if (/HT/i.test(matchTime)) status = "halftime";
  const match = { status, minute };
  return {
    key: `fifa-${event.IdMatch}`,
    home: zhTeam(fifaTeamName(event.Home)),
    away: zhTeam(fifaTeamName(event.Away)),
    score: {
      home: Number(event.Home?.Score) || 0,
      away: Number(event.Away?.Score) || 0,
    },
    status,
    minute,
    progressText: formatLiveProgress(match),
    events: [],
    scheduledAt: chinaDateTime(event.Date),
    sourceTimestamp: String(event.Date || ""),
  };
}

module.exports = {
  normalizeLiveMatch,
  livePayload,
  parseLiveMatches,
  parse500LiveMatches,
  normalizeTheSportsDbEvent,
  formatLiveProgress,
  chinaDateTime,
  worldCupEventsForChinaDate,
  fifaEventsForChinaDate,
  normalizeFifaLiveMatch,
};
