const test = require("node:test");
const assert = require("node:assert/strict");
const { getChinaDateOffset, getAnalysisSlot, isAnalysisDue } = require("../lib/china-time");

test("tomorrow respects Beijing midnight", () => {
  const now = new Date("2026-06-22T15:59:00.000Z");
  assert.equal(getChinaDateOffset(0, now), "2026-06-22");
  assert.equal(getChinaDateOffset(1, now), "2026-06-23");
});

test("analysis slot uses Beijing noon once per day", () => {
  assert.equal(getAnalysisSlot(new Date("2026-06-22T08:12:00.000Z")), "2026-06-22T12:00");
  assert.equal(isAnalysisDue(new Date("2026-06-22T03:59:00.000Z")), false);
  assert.equal(isAnalysisDue(new Date("2026-06-22T04:00:00.000Z")), true);
});
