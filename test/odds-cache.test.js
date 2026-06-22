const test = require("node:test");
const assert = require("node:assert/strict");
const { latestSnapshotForDate } = require("../lib/odds-cache");

test("restores the newest odds snapshot for the requested display date", () => {
  const snapshot = latestSnapshotForDate([
    { displayDate: "2026-06-23", fetchedAt: "2026-06-22T01:00:00.000Z", matches: [{ key: "old" }] },
    { displayDate: "2026-06-23", fetchedAt: "2026-06-22T02:00:00.000Z", matches: [{ key: "new" }] },
    { displayDate: "2026-06-24", fetchedAt: "2026-06-22T03:00:00.000Z", matches: [{ key: "other" }] },
  ], "2026-06-23");
  assert.equal(snapshot.matches[0].key, "new");
});
