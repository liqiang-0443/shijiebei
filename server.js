const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  getChinaDateOffset,
  getAnalysisSlot,
  isAnalysisDue,
} = require("./lib/china-time");
const {
  livePayload,
  normalizeTheSportsDbEvent,
  worldCupEventsForChinaDate,
  chinaDateTime,
  parse500LiveMatches,
  fifaEventsForChinaDate,
  normalizeFifaLiveMatch,
} = require("./lib/live-results");
const { shouldRunAnalysis } = require("./lib/analysis-schedule");
const { generateAnalysisSnapshot, generateFallbackAnalysisSnapshot } = require("./lib/analysis-service");
const { latestSnapshotForDate } = require("./lib/odds-cache");
const { buildTeamIntelligence } = require("./lib/team-intel");

const PORT = process.env.PORT || 4318;
const SOURCE_BASE = "https://trade.500.com/jczq/";
const SOURCES = [
  { key: "spf", name: "胜平负/让球", url: `${SOURCE_BASE}?playid=269&g=2` },
  { key: "bf", name: "比分", url: `${SOURCE_BASE}?playid=271&g=2` },
  { key: "jqs", name: "总进球数", url: `${SOURCE_BASE}?playid=270&g=2` },
  { key: "bqc", name: "半全场", url: `${SOURCE_BASE}?playid=272&g=2` },
  { key: "hh", name: "混合过关", url: `${SOURCE_BASE}?playid=312&g=2` },
];
const SOURCE_URL = SOURCES[0].url;
const SPORTS_DB_BASE = "https://www.thesportsdb.com/api/v1/json/3/eventsday.php";
const SCORE_PAGE_BASE = "https://live.500.com/wanchang.php";
const FIFA_MATCHES_BASE = "https://api.fifa.com/api/v3/calendar/matches";
const DISPLAY_LEAGUE = "世界杯";
const DISPLAY_TIME_ZONE = "Asia/Shanghai";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");
const PUBLIC_DIR = path.join(__dirname, "public");

let cache = {
  ok: false,
  sourceUrl: SOURCE_URL,
  fetchedAt: null,
  error: null,
  matches: [],
  previousByKey: {},
};
let liveCache = livePayload([], null, "live data has not been synchronized");
let analysisCache = { status: "unavailable", reason: "analysis has not been generated" };

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, "[]", "utf8");
  }
  if (!fs.existsSync(SUBMISSIONS_FILE)) {
    fs.writeFileSync(SUBMISSIONS_FILE, "[]", "utf8");
  }
}

function readHistory() {
  ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeHistory(history) {
  ensureDataDir();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(-288), null, 2), "utf8");
}

function restoreOddsCache(displayDate) {
  const snapshot = latestSnapshotForDate(readHistory(), displayDate);
  if (!snapshot) return null;
  return {
    ok: true,
    stale: true,
    sourceUrl: snapshot.sourceUrl || SOURCE_URL,
    sources: snapshot.sources || SOURCES,
    displayDate,
    fetchedAt: snapshot.fetchedAt,
    error: "赔率源暂时不可用，正在展示最后一次成功同步的数据。",
    matches: snapshot.matches.map((match) => ({
      ...match,
      league: DISPLAY_LEAGUE,
      matchDate: match.matchDate || displayDate,
      matchTime: match.matchTime || "",
      buyEndTime: match.buyEndTime || "",
      active: true,
      ended: false,
      single: match.single || baseSingle(),
      changes: match.changes || {},
    })),
    previousByKey: {},
  };
}

function readSubmissions() {
  ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeSubmissions(submissions) {
  ensureDataDir();
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions.slice(-1000), null, 2), "utf8");
}

function getLiveFile(date) {
  return path.join(DATA_DIR, `live-${date}.json`);
}

function readLiveCache(date) {
  ensureDataDir();
  const file = getLiveFile(date);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(parsed.matches) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLiveCache(date, payload) {
  ensureDataDir();
  const file = getLiveFile(date);
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(temp, file);
}

function getAnalysisFile(date) {
  return path.join(DATA_DIR, `analysis-${date}.json`);
}

function readAnalysisStore(date) {
  ensureDataDir();
  const file = getAnalysisFile(date);
  if (!fs.existsSync(file)) return { date, snapshots: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(parsed.snapshots) ? parsed : { date, snapshots: [] };
  } catch {
    return { date, snapshots: [] };
  }
}

function writeAnalysisStore(date, store) {
  ensureDataDir();
  const file = getAnalysisFile(date);
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(temp, file);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("invalid json body"));
      }
    });
    req.on("error", reject);
  });
}

function sanitizeSubmission(input) {
  const name = String(input.name || "").trim().slice(0, 24);
  const selections = Array.isArray(input.selections) ? input.selections.slice(0, 200) : [];
  const passModes = Array.isArray(input.passModes) ? input.passModes.slice(0, 20) : [];
  if (!name) throw new Error("name is required");
  if (!selections.length) throw new Error("selection is required");
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    submittedAt: new Date().toISOString(),
    name,
    multiplier: Number(input.multiplier) || 1,
    passModes,
    selectedCount: Number(input.selectedCount) || selections.length,
    ticketCount: Number(input.ticketCount) || 0,
    payAmount: Number(input.payAmount) || 0,
    bonusRange: String(input.bonusRange || ""),
    selections: selections.map((item) => ({
      matchKey: String(item.matchKey || ""),
      matchNum: String(item.matchNum || ""),
      teams: String(item.teams || ""),
      pool: String(item.pool || ""),
      label: String(item.label || ""),
      value: String(item.value || ""),
      sp: Number(item.sp) || 0,
      single: Boolean(item.single),
    })),
  };
}

function attrsToObject(attrs) {
  const out = {};
  const re = /([\w-]+)="([^"]*)"/g;
  let match;
  while ((match = re.exec(attrs))) out[match[1]] = decodeHtml(match[2]);
  return out;
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
}

function baseOdds() {
  return { nspf: {}, spf: {}, jqs: {}, bqc: {}, bf: {} };
}

function baseSingle() {
  return { nspf: false, spf: false, jqs: false, bqc: false, bf: false };
}

function parseSingleAvailability(value) {
  const flags = {};
  String(value || "").split(",").forEach((pair) => {
    const [key, raw] = pair.split(":");
    if (key) flags[key] = raw === "1";
  });
  return {
    nspf: Boolean(flags.nspfdg),
    spf: Boolean(flags.spfdg),
    jqs: Boolean(flags.jqdg),
    bqc: Boolean(flags.bqdg),
    bf: Boolean(flags.bfdg),
  };
}

function parseOdds(rowHtml) {
  const odds = baseOdds();
  const re = /<p[^>]*class="[^"]*\b(?:sbetbtn|betbtn)\b[^"]*"([^>]*)>([\s\S]*?)<\/p>/g;
  let match;
  while ((match = re.exec(rowHtml))) {
    const attrs = attrsToObject(match[1]);
    if (!odds[attrs["data-type"]]) continue;
    const value = attrs["data-value"];
    odds[attrs["data-type"]][value] = Number(attrs["data-sp"]);
  }
  return odds;
}

function makeKey(attrs) {
  return attrs["data-processid"] || `${attrs["data-matchnum"]}-${attrs["data-homeid"]}-${attrs["data-awayid"]}`;
}

function getMatchBlocks(html) {
  const marker = /<tr\b([^>]*)class="[^"]*\bbet-tb-tr\b[^"]*"([^>]*)>/g;
  const starts = [];
  let match;
  while ((match = marker.exec(html))) {
    starts.push({
      index: match.index,
      tagEnd: marker.lastIndex,
      attrs: `${match[1]} ${match[2]}`,
    });
  }
  return starts.map((start, index) => {
    const next = starts[index + 1]?.index ?? html.length;
    return {
      attrs: start.attrs,
      html: html.slice(start.tagEnd, next),
    };
  });
}

function parseMatches(html) {
  const rows = [];
  for (const block of getMatchBlocks(html)) {
    const attrs = attrsToObject(block.attrs);
    const rowHtml = block.html;
    const odds = parseOdds(rowHtml);
    const matchNum = attrs["data-matchnum"] || "";
    const home = attrs["data-homesxname"] || "";
    const away = attrs["data-awaysxname"] || "";
    const key = makeKey(attrs);

    if (!home || !away || !Object.values(odds).some((pool) => Object.keys(pool).length)) {
      continue;
    }

    rows.push({
      key,
      matchNum,
      league: attrs["data-simpleleague"] || "",
      home,
      away,
      matchDate: attrs["data-matchdate"] || "",
      matchTime: attrs["data-matchtime"] || "",
      buyEndTime: attrs["data-buyendtime"] || "",
      rangqiu: attrs["data-rangqiu"] || "",
      processDate: attrs["data-processdate"] || "",
      fixtureId: attrs["data-fixtureid"] || "",
      active: attrs["data-isactive"] === "1",
      ended: attrs["data-isend"] === "1",
      odds,
      single: parseSingleAvailability(attrs["data-subactive"]),
      sourceUrl: SOURCE_URL,
    });
  }
  return rows;
}

function mergeMatches(groups) {
  const byKey = new Map();
  for (const group of groups) {
    for (const match of group.matches) {
      const existing = byKey.get(match.key);
      if (!existing) {
        byKey.set(match.key, {
          ...match,
          odds: baseOdds(),
          single: baseSingle(),
          sourcePages: [],
        });
      }

      const target = byKey.get(match.key);
      for (const type of Object.keys(match.odds)) {
        target.odds[type] = { ...target.odds[type], ...match.odds[type] };
        target.single[type] = Boolean(target.single[type] || match.single[type]);
      }
      target.sourcePages.push({ key: group.key, name: group.name, url: group.url });
    }
  }

  return [...byKey.values()].sort((a, b) => {
    const day = String(a.processDate).localeCompare(String(b.processDate));
    if (day !== 0) return day;
    return String(a.matchNum).localeCompare(String(b.matchNum), "zh-CN");
  });
}

function flattenOdds(match) {
  const flat = {};
  for (const type of Object.keys(match.odds || {})) {
    for (const value of Object.keys(match.odds[type] || {})) {
      flat[`${type}_${value}`] = match.odds[type][value];
    }
  }
  return flat;
}

function withChanges(matches, previousByKey) {
  return matches.map((match) => {
    const now = flattenOdds(match);
    const prev = previousByKey[match.key] || {};
    const changes = {};
    for (const key of Object.keys(now)) {
      const before = prev[key];
      const after = now[key];
      changes[key] = {
        before: Number.isFinite(before) ? before : null,
        after,
        delta: Number.isFinite(before) ? Number((after - before).toFixed(2)) : 0,
      };
    }
    return { ...match, changes };
  });
}

function getTomorrowChinaDate() {
  return getChinaDateOffset(1);
}

function getTodayChinaDate() {
  return getChinaDateOffset(0);
}

async function fetchSourceHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
  });
  if (!response.ok) throw new Error(`source returned ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return new TextDecoder("gb18030").decode(bytes);
}

async function refreshData() {
  const fetchedAt = new Date().toISOString();
  const previousByKey = Object.fromEntries(cache.matches.map((match) => [match.key, flattenOdds(match)]));
  const displayDate = getTomorrowChinaDate();

  try {
    const groups = await Promise.all(SOURCES.map(async (source) => {
      const html = await fetchSourceHtml(source.url);
      return { ...source, matches: parseMatches(html) };
    }));
    const parsed = mergeMatches(groups).filter((match) => (
      match.league === DISPLAY_LEAGUE && match.matchDate === displayDate
    ));
    if (!parsed.length) throw new Error("no matches parsed from source page");

    const matches = withChanges(parsed, previousByKey);
    cache = {
      ok: true,
      sourceUrl: SOURCE_URL,
      sources: SOURCES,
      displayDate,
      fetchedAt,
      error: null,
      matches,
      previousByKey,
    };

    const history = readHistory();
    history.push({
      fetchedAt,
      sourceUrl: SOURCE_URL,
      sources: SOURCES,
      displayDate,
      count: matches.length,
      matches: matches.map((match) => ({
        key: match.key,
        matchNum: match.matchNum,
        home: match.home,
        away: match.away,
        rangqiu: match.rangqiu,
        matchDate: match.matchDate,
        matchTime: match.matchTime,
        buyEndTime: match.buyEndTime,
        odds: match.odds,
        single: match.single,
        sourcePages: match.sourcePages,
      })),
    });
    writeHistory(history);
    return cache;
  } catch (error) {
    const fallback = cache.displayDate === displayDate && cache.matches.length
      ? cache
      : restoreOddsCache(displayDate);
    cache = {
      ...(fallback || cache),
      ok: Boolean(fallback?.matches.length),
      stale: Boolean(fallback?.matches.length),
      lastAttemptAt: fetchedAt,
      error: error.message || String(error),
    };
    return cache;
  }
}

async function refreshLiveResults() {
  const date = getTodayChinaDate();
  const refreshedAt = new Date().toISOString();
  try {
    const from = getChinaDateOffset(-1);
    const to = getChinaDateOffset(1);
    const response = await fetch(`${FIFA_MATCHES_BASE}?idCompetition=17&from=${from}&to=${to}&language=en&count=100`, {
      headers: { "User-Agent": "WorldCupOddsPoc/1.0", Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`FIFA live source returned ${response.status}`);
    const body = await response.json();
    const payloads = fifaEventsForChinaDate(body.Results, date).map(normalizeFifaLiveMatch);
    const byKey = new Map();
    payloads.flat().forEach((match) => {
      byKey.set(match.key, match);
    });
    const matches = [...byKey.values()].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    if (!matches.length) throw new Error("no live matches parsed from FIFA source");
    const payload = {
      ...livePayload(matches, refreshedAt),
      date,
    };
    writeLiveCache(date, payload);
    liveCache = payload;
    return liveCache;
  } catch (error) {
    try {
      const pageDates = [getChinaDateOffset(-1), date];
      const fallbackMatches = [];
      for (const pageDate of pageDates) {
        const html = await fetchSourceHtml(`${SCORE_PAGE_BASE}?e=${pageDate}`);
        fallbackMatches.push(...parse500LiveMatches(html, date));
      }
      if (fallbackMatches.length) {
        const payload = {
          ...livePayload(fallbackMatches, refreshedAt, error.message || String(error)),
          date,
          source: "500-fallback",
        };
        writeLiveCache(date, payload);
        liveCache = payload;
        return liveCache;
      }
    } catch {}
    const cached = liveCache.date === date ? liveCache : readLiveCache(date);
    const fallback = cached && {
      ...cached,
      matches: (cached.matches || []).filter((match) => (
        !match.sourceTimestamp || chinaDateTime(match.sourceTimestamp).slice(0, 10) === date
      )),
    };
    liveCache = {
      ...(fallback || { date, matches: [], updatedAt: null }),
      ok: false,
      stale: true,
      error: error.message || String(error),
    };
    return liveCache;
  }
}

async function buildAnalysisFacts() {
  const intelligence = await buildTeamIntelligence(cache.matches).catch(() => new Map());
  return cache.matches.map((match) => {
    const teamIntel = intelligence.get(match.key) || {};
    return {
    key: match.key,
    matchNum: match.matchNum,
    home: match.home,
    away: match.away,
    matchDate: match.matchDate,
    matchTime: match.matchTime,
    handicap: match.rangqiu,
    odds: match.odds,
    statistics: teamIntel.statistics || {
      worldCupRanking: null,
      tournamentRecord: null,
      recentForm: null,
      headToHead: null,
    },
    dataGaps: teamIntel.dataGaps || ["球队统计数据源暂时不可用，本场仅基于赔率快照。"],
  };
  });
}

function latestAnalysis(store) {
  return store.snapshots.at(-1) || {
    status: "unavailable",
    reason: "analysis has not been generated",
    date: store.date,
  };
}

async function refreshAnalysis({ force = false } = {}) {
  const date = getTomorrowChinaDate();
  const slot = getAnalysisSlot();
  const store = readAnalysisStore(date);
  if (!force && !isAnalysisDue()) {
    analysisCache = latestAnalysis(store);
    return analysisCache;
  }
  if (!force && !shouldRunAnalysis(store.snapshots, slot, { retryNoMatches: cache.matches.length > 0 })) {
    analysisCache = latestAnalysis(store);
    return analysisCache;
  }

  try {
    const facts = await buildAnalysisFacts();
    let snapshot = facts.length
      ? await generateAnalysisSnapshot({
        apiKey: process.env.DEEPSEEK_API_KEY || "",
        facts,
        slot,
        model: process.env.DEEPSEEK_MODEL || undefined,
      })
      : { status: "unavailable", reason: "no tomorrow World Cup matches", slot };
    if (facts.length && snapshot.status === "unavailable") {
      snapshot = generateFallbackAnalysisSnapshot({ facts, slot, reason: snapshot.reason });
    }
    const record = {
      ...snapshot,
      date,
      dataUpdatedAt: cache.fetchedAt || null,
      facts,
    };
    store.snapshots.push(record);
    store.snapshots = store.snapshots.slice(-18);
    writeAnalysisStore(date, store);
    analysisCache = record;
    return analysisCache;
  } catch (error) {
    const facts = await buildAnalysisFacts().catch(() => []);
    const fallback = facts.length
      ? generateFallbackAnalysisSnapshot({ facts, slot, reason: error.message || String(error) })
      : latestAnalysis(store);
    const record = {
      ...fallback,
      date,
      dataUpdatedAt: cache.fetchedAt || null,
      facts,
      stale: true,
      error: error.message || String(error),
    };
    if (facts.length) {
      store.snapshots.push(record);
      store.snapshots = store.snapshots.slice(-18);
      writeAnalysisStore(date, store);
    }
    analysisCache = record;
    return analysisCache;
  }
}

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function isLoopback(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function sendStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath === "/" ? "index.html" : urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath);
  const contentType = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
  }[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === "/api/matches") {
    sendJson(res, cache);
    return;
  }
  if (url.pathname === "/api/refresh") {
    sendJson(res, await refreshData());
    return;
  }
  if (url.pathname === "/api/history") {
    sendJson(res, readHistory());
    return;
  }
  if (url.pathname === "/api/live-matches" && req.method === "GET") {
    sendJson(res, liveCache);
    return;
  }
  if (url.pathname === "/api/match-analysis" && req.method === "GET") {
    sendJson(res, analysisCache);
    return;
  }
  if (url.pathname === "/api/analysis/deploy" && req.method === "POST") {
    if (!isLoopback(req.socket.remoteAddress)) {
      sendJson(res, { ok: false, error: "forbidden" }, 403);
      return;
    }
    sendJson(res, await refreshAnalysis({ force: true }));
    return;
  }
  if (url.pathname === "/api/submissions" && req.method === "GET") {
    const today = getTodayChinaDate();
    const submissions = readSubmissions()
      .filter((item) => formatChinaDate(new Date(item.submittedAt)) === today)
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    sendJson(res, { ok: true, date: today, submissions });
    return;
  }
  if (url.pathname === "/api/submissions" && req.method === "POST") {
    try {
      const input = await readJsonBody(req);
      const submission = sanitizeSubmission(input);
      const submissions = readSubmissions();
      submissions.push(submission);
      writeSubmissions(submissions);
      sendJson(res, { ok: true, submission });
    } catch (error) {
      sendJson(res, { ok: false, error: error.message || String(error) }, 400);
    }
    return;
  }
  if (url.pathname.startsWith("/api/submissions/") && req.method === "DELETE") {
    const id = decodeURIComponent(url.pathname.replace("/api/submissions/", ""));
    const submissions = readSubmissions();
    const next = submissions.filter((item) => item.id !== id);
    if (next.length === submissions.length) {
      sendJson(res, { ok: false, error: "submission not found" }, 404);
      return;
    }
    writeSubmissions(next);
    sendJson(res, { ok: true, id });
    return;
  }
  sendStatic(req, res);
});

ensureDataDir();
cache = restoreOddsCache(getTomorrowChinaDate()) || cache;
liveCache = readLiveCache(getTodayChinaDate()) || liveCache;
analysisCache = latestAnalysis(readAnalysisStore(getTomorrowChinaDate()));
server.listen(PORT, () => {
  console.log(`World Cup odds PoC running at http://localhost:${PORT}`);
});
refreshData().then(() => Promise.all([refreshLiveResults(), refreshAnalysis()])).catch(() => {});

setInterval(refreshData, 5 * 60 * 1000);
setInterval(refreshLiveResults, 60 * 1000);
setInterval(refreshAnalysis, 60 * 1000);
