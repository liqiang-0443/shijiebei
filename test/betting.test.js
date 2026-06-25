const test = require("node:test");
const assert = require("node:assert/strict");
const { estimateBonusRange } = require("../public/betting");

function pick(matchKey, label, sp) {
  return {
    key: `${matchKey}::${label}`,
    matchKey,
    pool: "nspf",
    value: label,
    label,
    sp,
    single: true,
  };
}

test("bonus max does not add mutually exclusive picks from the same match", () => {
  const selections = [
    pick("m1", "胜", 2),
    pick("m1", "平", 3),
    pick("m2", "胜", 4),
  ];

  const result = estimateBonusRange(selections, [2], 1);

  assert.equal(result.tickets.length, 2);
  assert.equal(result.minBonus, 16);
  assert.equal(result.maxBonus, 24);
});

test("bonus max can add compatible winning tickets across different match combinations", () => {
  const selections = [
    pick("m1", "胜", 2),
    pick("m2", "胜", 3),
    pick("m3", "胜", 4),
  ];

  const result = estimateBonusRange(selections, [2], 1);

  assert.equal(result.tickets.length, 3);
  assert.equal(result.minBonus, 12);
  assert.equal(result.maxBonus, 52);
});
