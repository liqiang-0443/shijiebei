const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function createElement() {
  return {
    disabled: false,
    innerHTML: "",
    textContent: "",
    value: "",
    addEventListener() {},
  };
}

test("submission matches render in match number order", async () => {
  const elements = new Map();
  ["#submissionList", "#payerSummary", "#adminRefreshBtn", "#nameFilter", "#typeFilter"].forEach((selector) => {
    elements.set(selector, createElement());
  });

  const context = vm.createContext({
    document: {
      querySelector(selector) {
        return elements.get(selector);
      },
    },
    fetch: async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        submissions: [{
          id: "test",
          name: "强",
          submittedAt: "2026-06-22T04:00:00.000Z",
          selectedCount: 3,
          ticketCount: 1,
          multiplier: 1,
          payAmount: 2,
          bonusRange: "2.00 - 4.00",
          passModes: ["3串1"],
          selections: [
            { matchNum: "周一043", teams: "C VS D", pool: "nspf", label: "胜", sp: 1.8 },
            { matchNum: "周一041", teams: "A VS B", pool: "nspf", label: "平", sp: 3.2 },
            { matchNum: "周一042", teams: "E VS F", pool: "jqs", label: "3球", sp: 4.1 },
          ],
        }],
      }),
    }),
    Intl,
    Date,
    Number,
    String,
    Map,
    Set,
    window: { confirm: () => false },
  });

  vm.runInContext(fs.readFileSync("public/admin.js", "utf8"), context);
  await new Promise((resolve) => setImmediate(resolve));

  const html = elements.get("#submissionList").innerHTML;
  const positions = ["041", "042", "043"].map((num) => html.indexOf(`<em>${num}</em>`));
  assert.deepEqual(positions.map((position) => position >= 0), [true, true, true]);
  assert.ok(positions[0] < positions[1]);
  assert.ok(positions[1] < positions[2]);
});
