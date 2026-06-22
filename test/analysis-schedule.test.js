const test = require("node:test");
const assert = require("node:assert/strict");
const { shouldRunAnalysis } = require("../lib/analysis-schedule");

test("runs a missing current slot once and skips an existing slot", () => {
  assert.equal(shouldRunAnalysis([], "2026-06-22T16:10"), true);
  assert.equal(shouldRunAnalysis([{ slot: "2026-06-22T16:10" }], "2026-06-22T16:10"), false);
});
