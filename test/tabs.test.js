const test = require("node:test");
const assert = require("node:assert/strict");
const { activeTabNames } = require("../public/tabs");

test("selects exactly the requested tab", () => {
  assert.deepEqual(activeTabNames(["live", "analysis", "selection", "submissions"], "analysis"), {
    active: "analysis",
    inactive: ["live", "selection", "submissions"],
  });
});
