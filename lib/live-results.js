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

function normalizeTheSportsDbEvent(event) {
  return {
    key: `thesportsdb-${event.idEvent}`,
    home: String(event.strHomeTeam || ""),
    away: String(event.strAwayTeam || ""),
    score: {
      home: Number(event.intHomeScore) || 0,
      away: Number(event.intAwayScore) || 0,
    },
    status: sportsDbStatusMap[event.strStatus] || "scheduled",
    minute: null,
    events: [],
    scheduledAt: String(event.strTimestamp || ""),
  };
}

module.exports = { normalizeLiveMatch, livePayload, parseLiveMatches, normalizeTheSportsDbEvent };
