const { validateAnalysis } = require("./analysis-schema");

const DEFAULT_MODEL = "deepseek-v4-pro";
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const ANALYSIS_TIMEOUT_MS = 25000;

function outputText(response) {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  throw new Error("analysis response did not contain text");
}

function analysisInstructions() {
  return [
    "你是世界杯赛前数据分析助手。",
    "输入中的 odds 为明日选单使用的中国体育彩票赔率，是盘口判断的唯一赔率依据，必须优先使用。",
    "只能依据输入的结构化事实和你能够确认的公开信息；不得编造伤停、新闻、排名、历史交锋或战绩。若 injuries 为空或标记为暂无，必须在 risks 中明确伤停未确认，不能自行补写具体球员。",
    "每场必须输出胜平负、让球胜平负、总进球数、三个比分和一到两个半全场组合。",
    "Return a JSON object only, shaped as {\"matches\":[{\"key\":\"...\",\"result\":\"主胜|平|客胜\",\"handicap\":\"让胜|让平|让负\",\"goals\":[\"0球|1球|2球|3球|4球|5球|6球|7+\"],\"scores\":[\"1:0\",\"1:1\",\"0:1\"],\"halfFull\":[\"胜胜|胜平|胜负|平胜|平平|平负|负胜|负平|负负\"],\"confidence\":\"低|中|高\",\"evidence\":[\"...\"],\"risks\":[\"...\"]}]}",
    "信息缺失或冲突时必须使用低信心，并在风险中说明。",
  ].join("\n");
}

function bestKey(odds = {}) {
  return Object.entries(odds)
    .filter(([, value]) => Number.isFinite(Number(value)))
    .sort((a, b) => Number(a[1]) - Number(b[1]))[0]?.[0];
}

function topKeys(odds = {}, count) {
  return Object.entries(odds)
    .filter(([, value]) => Number.isFinite(Number(value)))
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .slice(0, count)
    .map(([key]) => key);
}

function topScoreKeys(odds = {}, count) {
  return topKeys(odds, 64).filter((key) => /^\d+:\d+$/.test(key)).slice(0, count);
}

function generateFallbackAnalysisSnapshot({ facts, slot, reason }) {
  const resultMap = { 3: "主胜", 1: "平", 0: "客胜" };
  const handicapMap = { 3: "让胜", 1: "让平", 0: "让负" };
  const goalsMap = { 0: "0球", 1: "1球", 2: "2球", 3: "3球", 4: "4球", 5: "5球", 6: "6球", 7: "7+" };
  const halfFullMap = {
    "3-3": "胜胜",
    "3-1": "胜平",
    "3-0": "胜负",
    "1-3": "平胜",
    "1-1": "平平",
    "1-0": "平负",
    "0-3": "负胜",
    "0-1": "负平",
    "0-0": "负负",
  };
  const matches = facts.map((fact) => {
    const odds = fact.odds || {};
    return {
      key: fact.key,
      result: resultMap[bestKey(odds.nspf)] || resultMap[bestKey(odds.spf)] || "平",
      handicap: handicapMap[bestKey(odds.spf)] || "让平",
      goals: topKeys(odds.jqs, 2).map((key) => goalsMap[key]).filter(Boolean).slice(0, 2),
      scores: topScoreKeys(odds.bf, 3),
      halfFull: topKeys(odds.bqc, 2).map((key) => halfFullMap[key]).filter(Boolean).slice(0, 2),
      confidence: "低",
      evidence: [
        "模型接口暂不可用，本场使用赔率最低项生成保底建议。",
        `${fact.home} vs ${fact.away} 的胜平负、总进球数、比分和半全场均来自当前赔率快照。`,
      ],
      risks: [
        `模型分析未完成：${reason || "provider unavailable"}`,
        "保底建议未结合实时伤停和临场新闻，只适合作为低信心参考。",
      ],
    };
  });
  for (const match of matches) {
    if (!match.goals.length) match.goals = ["2球"];
    if (match.scores.length < 3) match.scores = [...match.scores, "1:1", "1:0", "0:1"].slice(0, 3);
    if (!match.halfFull.length) match.halfFull = ["平平"];
  }
  return {
    status: "ready",
    source: "local-fallback",
    slot,
    generatedAt: new Date().toISOString(),
    analysis: validateAnalysis({ matches }),
  };
}

async function generateAnalysisSnapshot({ apiKey, facts, slot, model = DEFAULT_MODEL, fetchImpl = fetch, timeoutMs = ANALYSIS_TIMEOUT_MS }) {
  if (!apiKey) {
    return {
      status: "unavailable",
      reason: "analysis key is not configured",
      slot,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: analysisInstructions() },
          { role: "user", content: JSON.stringify({ matches: facts }) },
        ],
        response_format: { type: "json_object" },
      }),
    });
  } catch (error) {
    if (controller.signal.aborted) throw new Error("analysis provider timed out");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`analysis provider returned ${response.status}`);
  const analysis = validateAnalysis(JSON.parse(outputText(await response.json())));
  return {
    status: "ready",
    slot,
    generatedAt: new Date().toISOString(),
    analysis,
  };
}

module.exports = { DEFAULT_MODEL, DEEPSEEK_API_URL, ANALYSIS_TIMEOUT_MS, generateAnalysisSnapshot, generateFallbackAnalysisSnapshot };
