const { validateAnalysis } = require("./analysis-schema");

const DEFAULT_MODEL = "deepseek-v4-pro";
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

function outputText(response) {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  throw new Error("analysis response did not contain text");
}

function analysisInstructions() {
  return [
    "你是世界杯赛前数据分析助手。",
    "只能依据输入的结构化事实，不得编造伤停、新闻、排名、历史交锋或战绩。",
    "每场必须输出胜平负、让球胜平负、总进球数、三个比分和一到两个半全场组合。",
    "信息缺失或冲突时必须使用低信心，并在风险中说明。",
  ].join("\n");
}

async function generateAnalysisSnapshot({ apiKey, facts, slot, model = DEFAULT_MODEL, fetchImpl = fetch }) {
  if (!apiKey) {
    return {
      status: "unavailable",
      reason: "analysis key is not configured",
      slot,
    };
  }

  const response = await fetchImpl(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: analysisInstructions() },
        { role: "user", content: JSON.stringify({ matches: facts }) },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) throw new Error(`analysis provider returned ${response.status}`);
  const analysis = validateAnalysis(JSON.parse(outputText(await response.json())));
  return {
    status: "ready",
    slot,
    generatedAt: new Date().toISOString(),
    analysis,
  };
}

module.exports = { DEFAULT_MODEL, DEEPSEEK_API_URL, generateAnalysisSnapshot };
