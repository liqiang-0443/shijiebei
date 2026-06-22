const test = require("node:test");
const assert = require("node:assert/strict");
const { generateAnalysisSnapshot } = require("../lib/analysis-service");

test("returns an explicit unavailable state without an API key", async () => {
  const result = await generateAnalysisSnapshot({
    apiKey: "",
    facts: [{ key: "m1" }],
    slot: "2026-06-22T16:10",
    fetchImpl: async () => {
      throw new Error("must not call the network");
    },
  });
  assert.deepEqual(result, {
    status: "unavailable",
    reason: "analysis key is not configured",
    slot: "2026-06-22T16:10",
  });
});

test("uses DeepSeek V4 Pro through its chat completions endpoint", async () => {
  let request;
  const result = await generateAnalysisSnapshot({
    apiKey: "test-key",
    facts: [{ key: "m1" }],
    slot: "2026-06-22T16:10",
    fetchImpl: async (url, options) => {
      request = { url, options: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({
            matches: [{
              key: "m1", result: "主胜", handicap: "让负", goals: ["2球"],
              scores: ["1:1", "2:1", "1:0"], halfFull: ["平胜"], confidence: "中",
              evidence: ["赔率倾向"], risks: ["样本不足"],
            }],
          }) } }],
        }),
      };
    },
  });
  assert.equal(request.url, "https://api.deepseek.com/chat/completions");
  assert.equal(request.options.model, "deepseek-v4-pro");
  assert.match(JSON.stringify(request.options.messages), /json/i);
  assert.equal(result.status, "ready");
});

test("accepts broader model total-goals wording from DeepSeek responses", async () => {
  const result = await generateAnalysisSnapshot({
    apiKey: "test-key",
    facts: [{ key: "m1" }],
    slot: "2026-06-22T16:10",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          matches: [{
            key: "m1", result: "主胜", handicap: "让负", goals: ["2-4球"],
            scores: ["1:1", "2:1", "1:0"], halfFull: ["平胜"], confidence: "中",
            evidence: ["赔率倾向"], risks: ["样本不足"],
          }],
        }) } }],
      }),
    }),
  });
  assert.equal(result.status, "ready");
  assert.deepEqual(result.analysis.matches[0].goals, ["2球", "3球", "4球"]);
});
