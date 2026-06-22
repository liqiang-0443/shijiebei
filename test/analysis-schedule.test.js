const test = require("node:test");
const assert = require("node:assert/strict");
const { shouldRunAnalysis } = require("../lib/analysis-schedule");

test("runs a missing current slot once and skips an existing slot", () => {
  assert.equal(shouldRunAnalysis([], "2026-06-22T12:00"), true);
  assert.equal(shouldRunAnalysis([{ slot: "2026-06-22T12:00" }], "2026-06-22T12:00"), false);
});

test("retries a slot whose first run had no matches", () => {
  assert.equal(shouldRunAnalysis([
    { slot: "2026-06-22T12:00", status: "unavailable", reason: "no tomorrow World Cup matches" },
  ], "2026-06-22T12:00", { retryNoMatches: true }), true);
});
