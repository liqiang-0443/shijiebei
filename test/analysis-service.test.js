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
