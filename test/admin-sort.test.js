const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function createElement() {
  const listeners = {};
  return {
    disabled: false,
    innerHTML: "",
    textContent: "",
    value: "",
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    dispatchEvent(event) {
      return listeners[event.type]?.(event);
    },
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

  vm.runInContext(`${fs.readFileSync("public/betting.js", "utf8")}\n${fs.readFileSync("public/admin.js", "utf8")}`, context);
  await new Promise((resolve) => setImmediate(resolve));

  const html = elements.get("#submissionList").innerHTML;
  const positions = ["041", "042", "043"].map((num) => html.indexOf(`<em>${num}</em>`));
  assert.deepEqual(positions.map((position) => position >= 0), [true, true, true]);
  assert.ok(positions[0] < positions[1]);
  assert.ok(positions[1] < positions[2]);
});

test("submissions render grouped by payer name", async () => {
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
        submissions: [
          { id: "3", name: "芝", submittedAt: "2026-06-22T03:00:00.000Z", payAmount: 2, selections: [] },
          { id: "1", name: "强", submittedAt: "2026-06-22T05:00:00.000Z", payAmount: 2, selections: [] },
          { id: "2", name: "浩", submittedAt: "2026-06-22T04:00:00.000Z", payAmount: 2, selections: [] },
          { id: "4", name: "强", submittedAt: "2026-06-22T06:00:00.000Z", payAmount: 2, selections: [] },
        ],
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

  vm.runInContext(`${fs.readFileSync("public/betting.js", "utf8")}\n${fs.readFileSync("public/admin.js", "utf8")}`, context);
  await new Promise((resolve) => setImmediate(resolve));

  const html = elements.get("#submissionList").innerHTML;
  const names = [...html.matchAll(/class="submission-name"[^>]*data-filter-name="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(names, ["浩", "强", "强", "芝"]);
});

test("clicking a payer name toggles the name filter", async () => {
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
        submissions: [
          { id: "1", name: "强", submittedAt: "2026-06-22T05:00:00.000Z", payAmount: 2, selections: [] },
          { id: "2", name: "浩", submittedAt: "2026-06-22T04:00:00.000Z", payAmount: 2, selections: [] },
        ],
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

  vm.runInContext(`${fs.readFileSync("public/betting.js", "utf8")}\n${fs.readFileSync("public/admin.js", "utf8")}`, context);
  await new Promise((resolve) => setImmediate(resolve));

  const target = { closest: () => ({ dataset: { filterName: "浩" } }) };
  elements.get("#submissionList").dispatchEvent({ type: "click", target });
  assert.equal(elements.get("#nameFilter").value, "浩");
  assert.match(elements.get("#submissionList").innerHTML, /浩/);
  assert.doesNotMatch(elements.get("#submissionList").innerHTML, /强/);

  elements.get("#submissionList").dispatchEvent({ type: "click", target });
  assert.equal(elements.get("#nameFilter").value, "");
});

test("payer summary keeps daily totals when the list is name-filtered", async () => {
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
        submissions: [
          { id: "1", name: "浩", submittedAt: "2026-06-22T05:00:00.000Z", payAmount: 60, selections: [] },
          { id: "2", name: "芝", submittedAt: "2026-06-22T04:00:00.000Z", payAmount: 24, selections: [] },
        ],
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

  vm.runInContext(`${fs.readFileSync("public/betting.js", "utf8")}\n${fs.readFileSync("public/admin.js", "utf8")}`, context);
  await new Promise((resolve) => setImmediate(resolve));

  const target = { closest: () => ({ dataset: { filterName: "浩" } }) };
  elements.get("#submissionList").dispatchEvent({ type: "click", target });

  assert.match(elements.get("#submissionList").innerHTML, /浩/);
  assert.doesNotMatch(elements.get("#submissionList").innerHTML, /芝/);
  assert.match(elements.get("#payerSummary").innerHTML, /84\.00/);
  assert.match(elements.get("#payerSummary").innerHTML, /浩/);
  assert.match(elements.get("#payerSummary").innerHTML, /60\.00/);
  assert.match(elements.get("#payerSummary").innerHTML, /芝/);
  assert.match(elements.get("#payerSummary").innerHTML, /24\.00/);
});

test("refreshes submissions whenever the submissions tab is entered", async () => {
  const elements = new Map();
  ["#submissionList", "#payerSummary", "#adminRefreshBtn", "#nameFilter", "#typeFilter", ".workbench"].forEach((selector) => {
    elements.set(selector, createElement());
  });
  let fetchCount = 0;

  const context = vm.createContext({
    document: {
      querySelector(selector) {
        return elements.get(selector);
      },
    },
    fetch: async () => {
      fetchCount += 1;
      return {
        ok: true,
        json: async () => ({ ok: true, submissions: [] }),
      };
    },
    Intl,
    Date,
    Number,
    String,
    Map,
    Set,
    window: { confirm: () => false },
  });

  vm.runInContext(`${fs.readFileSync("public/betting.js", "utf8")}\n${fs.readFileSync("public/admin.js", "utf8")}`, context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetchCount, 1);

  elements.get(".workbench").dispatchEvent({ type: "worldcup:tabchange", detail: { active: "analysis" } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetchCount, 1);

  elements.get(".workbench").dispatchEvent({ type: "worldcup:tabchange", detail: { active: "submissions" } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetchCount, 2);
});

test("submission renders as a ticket-style match list", async () => {
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
          id: "ticket",
          name: "浩",
          submittedAt: "2026-06-25T04:00:00.000Z",
          selectedCount: 2,
          ticketCount: 1,
          multiplier: 1,
          payAmount: 2,
          passModes: ["2串1"],
          selections: [
            { matchKey: "m1", matchNum: "周四055", teams: "厄瓜多尔 VS 德国", pool: "nspf", label: "主胜", value: "3", sp: 2 },
            { matchKey: "m2", matchNum: "周四056", teams: "库拉索 VS 科特迪瓦", pool: "rqspf", label: "主胜", value: "3", sp: 3 },
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

  vm.runInContext(`${fs.readFileSync("public/betting.js", "utf8")}\n${fs.readFileSync("public/admin.js", "utf8")}`, context);
  await new Promise((resolve) => setImmediate(resolve));

  const html = elements.get("#submissionList").innerHTML;
  assert.match(html, /submission-ticket/);
  assert.match(html, /ticket-match-row/);
  assert.match(html, /ticket-match-code/);
  assert.match(html, /ticket-choice-box/);
  assert.match(html, /厄瓜多尔/);
  assert.match(html, /德国/);
  assert.match(html, /主胜【让】/);
  assert.doesNotMatch(html, /rqspf/);
  assert.doesNotMatch(html, /让球胜平负/);
  assert.doesNotMatch(html, /3\.00/);
});

test("submission bonus range is recalculated with mutually exclusive picks", async () => {
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
          id: "bonus",
          name: "浩",
          submittedAt: "2026-06-25T04:00:00.000Z",
          selectedCount: 3,
          ticketCount: 2,
          multiplier: 1,
          payAmount: 4,
          bonusRange: "16.00 - 40.00",
          passModes: ["2串1"],
          selections: [
            { key: "m1-win", matchKey: "m1", matchNum: "周四055", teams: "A VS B", pool: "nspf", label: "胜", value: "3", sp: 2 },
            { key: "m1-draw", matchKey: "m1", matchNum: "周四055", teams: "A VS B", pool: "nspf", label: "平", value: "1", sp: 3 },
            { key: "m2-win", matchKey: "m2", matchNum: "周四056", teams: "C VS D", pool: "nspf", label: "胜", value: "3", sp: 4 },
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

  vm.runInContext(`${fs.readFileSync("public/betting.js", "utf8")}\n${fs.readFileSync("public/admin.js", "utf8")}`, context);
  await new Promise((resolve) => setImmediate(resolve));

  const html = elements.get("#submissionList").innerHTML;
  assert.match(html, /奖金 16\.00 - 24\.00/);
  assert.doesNotMatch(html, /40\.00/);
});
