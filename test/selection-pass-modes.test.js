const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function createElement(initial = {}) {
  return {
    innerHTML: "",
    textContent: "",
    value: "",
    disabled: false,
    className: "",
    dataset: {},
    classList: { toggle() {} },
    addEventListener() {},
    ...initial,
  };
}

function makeMatch(index) {
  return {
    key: `m${index}`,
    matchNum: `周三0${index}`,
    league: "世界杯",
    home: `主${index}`,
    away: `客${index}`,
    matchDate: "2026-06-25",
    matchTime: "18:00",
    buyEndTime: "17:45",
    rangqiu: "0",
    odds: { nspf: { 3: 2 } },
    single: { nspf: true },
    changes: {},
  };
}

async function renderPassModesForMatchCount(matchCount) {
  const matches = Array.from({ length: matchCount }, (_, index) => makeMatch(index + 1));
  const selected = matches.map((match) => ({
    key: `${match.key}::nspf::3`,
    matchKey: match.key,
    matchNum: match.matchNum,
    teams: `${match.home} VS ${match.away}`,
    pool: "nspf",
    value: "3",
    label: "胜",
    sp: 2,
    single: true,
  }));
  const elements = new Map();
  [
    "#refreshBtn", "#statusText", "#matchCount", "#updatedAt", "#typeSelect", "#multiplierInput",
    "#selectedCount", "#ticketCount", "#payAmount", "#bonusRange", "#passModes", "#selectedPreview",
    "#clearSelectionBtn", "#nameSelect", "#customNameInput", ".submit-row", "#submitBetBtn",
    "#submitStatus", "#matchList", "#matchBody",
  ].forEach((selector) => elements.set(selector, createElement()));
  elements.get("#multiplierInput").value = "1";

  const context = vm.createContext({
    document: {
      querySelector(selector) {
        return elements.get(selector) || null;
      },
    },
    localStorage: {
      getItem: () => JSON.stringify({ selected, passModes: [matchCount] }),
      setItem() {},
    },
    fetch: async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        fetchedAt: "2026-06-24T08:00:00.000Z",
        matches,
      }),
    }),
    Intl,
    Date,
    Number,
    String,
    Map,
    Set,
    Array,
    Math,
    setInterval() {},
  });

  vm.runInContext(fs.readFileSync("public/app.js", "utf8"), context);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  return elements;
}

test("selection pass modes expand to six-match 6串1", async () => {
  const elements = await renderPassModesForMatchCount(6);
  assert.match(elements.get("#passModes").innerHTML, /data-pass-mode="6"/);
  assert.match(elements.get("#passModes").innerHTML, /6串1/);
  assert.equal(elements.get("#ticketCount").textContent, "1");
});

test("selection pass modes expand to eight-match 8串1", async () => {
  const elements = await renderPassModesForMatchCount(8);
  assert.match(elements.get("#passModes").innerHTML, /data-pass-mode="8"/);
  assert.match(elements.get("#passModes").innerHTML, /8串1/);
  assert.equal(elements.get("#ticketCount").textContent, "1");
});
