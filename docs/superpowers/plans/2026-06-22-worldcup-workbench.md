# World Cup Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Deliver one World Cup workbench containing live scores, scheduled predictions, the existing selection flow, and today's selection records.

**Architecture:** The Node server remains the only external-data client and persists cache data in DATA_DIR. New pure helper modules cover China-time scheduling, live payloads, and analysis validation; the frontend has a tab controller plus focused live, analysis, selection, and submission modules.

**Tech Stack:** Node.js 20 built-in http, fetch and node:test; vanilla HTML, CSS, and JavaScript; a model API key supplied only by server environment.

---

### Task 1: Establish tests and Beijing-time scheduling

**Files:**
- Create: lib/china-time.js
- Create: lib/analysis-schedule.js
- Create: test/china-time.test.js
- Create: test/analysis-schedule.test.js
- Modify: package.json
- Modify: server.js

- [ ] **Step 1: Write failing China-time test**

~~~js
const test = require("node:test");
const assert = require("node:assert/strict");
const { getChinaDateOffset, getAnalysisSlot } = require("../lib/china-time");

test("tomorrow respects Beijing midnight", () => {
  const now = new Date("2026-06-22T15:59:00.000Z");
  assert.equal(getChinaDateOffset(0, now), "2026-06-22");
  assert.equal(getChinaDateOffset(1, now), "2026-06-23");
});

test("analysis slot uses the current Beijing four-hour window", () => {
  assert.equal(getAnalysisSlot(new Date("2026-06-22T08:12:00.000Z")), "2026-06-22T16:10");
});
~~~

- [ ] **Step 2: Verify the test fails**

Run: node --test test/china-time.test.js

Expected: Cannot find module ../lib/china-time.

- [ ] **Step 3: Implement the smallest time API**

~~~js
const TIME_ZONE = "Asia/Shanghai";

function chinaParts(date = new Date()) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).formatToParts(date).map((part) => [part.type, part.value]));
}

function getChinaDateOffset(offsetDays, now = new Date()) {
  const parts = chinaParts(now);
  const utc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  return new Date(utc + offsetDays * 86400000).toISOString().slice(0, 10);
}

function getAnalysisSlot(now = new Date()) {
  const parts = chinaParts(now);
  const hour = Number(parts.hour) - (Number(parts.hour) % 4);
  return parts.year + "-" + parts.month + "-" + parts.day + "T" + String(hour).padStart(2, "0") + ":10";
}

module.exports = { TIME_ZONE, chinaParts, getChinaDateOffset, getAnalysisSlot };
~~~

- [ ] **Step 4: Write, fail, and implement the slot predicate**

~~~js
const test = require("node:test");
const assert = require("node:assert/strict");
const { shouldRunAnalysis } = require("../lib/analysis-schedule");

test("runs one missing slot but not an existing slot", () => {
  assert.equal(shouldRunAnalysis([], "2026-06-22T16:10"), true);
  assert.equal(shouldRunAnalysis([{ slot: "2026-06-22T16:10" }], "2026-06-22T16:10"), false);
});
~~~

Run: node --test test/analysis-schedule.test.js

Then create lib/analysis-schedule.js:

~~~js
function shouldRunAnalysis(history, slot) {
  return !history.some((item) => item.slot === slot);
}

module.exports = { shouldRunAnalysis };
~~~

- [ ] **Step 5: Wire imports and test command**

Replace server-local Beijing date helpers with the module import. Add this script:

~~~json
"test": "node --test"
~~~

Run: npm test

Expected: 3 passing tests.

- [ ] **Step 6: Commit**

~~~bash
git add package.json server.js lib/china-time.js lib/analysis-schedule.js test/china-time.test.js test/analysis-schedule.test.js
git commit -m "Add Beijing analysis scheduling helpers"
~~~

### Task 2: Add persisted live results

**Files:**
- Create: lib/live-results.js
- Create: test/live-results.test.js
- Modify: server.js

- [ ] **Step 1: Write failing normalization and stale-cache tests**

~~~js
const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeLiveMatch, livePayload } = require("../lib/live-results");

test("normalizes a live score", () => {
  assert.deepEqual(normalizeLiveMatch({
    id: "f1", home: "A", away: "B", homeScore: "1", awayScore: "0",
    status: "上半场", minute: "43",
  }), {
    key: "f1", home: "A", away: "B", score: { home: 1, away: 0 },
    status: "first_half", minute: 43, events: [],
  });
});

test("retains prior matches on source failure", () => {
  const payload = livePayload([{ key: "f1" }], "2026-06-22T08:00:00.000Z", "source unavailable");
  assert.equal(payload.stale, true);
  assert.equal(payload.matches.length, 1);
});
~~~

- [ ] **Step 2: Verify failure**

Run: node --test test/live-results.test.js

Expected: Cannot find module ../lib/live-results.

- [ ] **Step 3: Implement source-neutral live model**

~~~js
const statusMap = {
  "未开赛": "scheduled", "上半场": "first_half", "中场": "halftime",
  "下半场": "second_half", "完场": "finished", "延期": "postponed",
};

function normalizeLiveMatch(raw) {
  return {
    key: String(raw.id), home: String(raw.home), away: String(raw.away),
    score: { home: Number(raw.homeScore) || 0, away: Number(raw.awayScore) || 0 },
    status: statusMap[raw.status] || "scheduled",
    minute: Number.isFinite(Number(raw.minute)) ? Number(raw.minute) : null,
    events: Array.isArray(raw.events) ? raw.events : [],
  };
}

function livePayload(matches, updatedAt, error = null) {
  return { ok: !error, stale: Boolean(error), updatedAt, error, matches };
}

module.exports = { normalizeLiveMatch, livePayload };
~~~

- [ ] **Step 4: Add the live source adapter and persistent cache**

In server.js, introduce a dedicated source adapter for the validated 500 live page response. It must only normalize World Cup rows for the Beijing current date. Persist a successful payload as live-YYYY-MM-DD.json. On failures, reload or keep the latest good data and mark it stale. Do not overwrite a good cache with an error payload.

- [ ] **Step 5: Add endpoint and minute scheduler**

Add GET /api/live-matches before static routing. It returns updatedAt, stale, error, and matches. Run refreshLiveResults at startup and every 60 seconds.

- [ ] **Step 6: Verify and commit**

Run: npm test

Run: (Invoke-WebRequest http://localhost:4318/api/live-matches -UseBasicParsing).Content

Expected: JSON containing updatedAt, stale, and matches.

~~~bash
git add server.js lib/live-results.js test/live-results.test.js
git commit -m "Add cached World Cup live results"
~~~

### Task 3: Generate validated four-hour analysis snapshots

**Files:**
- Create: lib/analysis-schema.js
- Create: lib/analysis-service.js
- Create: test/analysis-schema.test.js
- Modify: server.js

- [ ] **Step 1: Write failing analysis-schema tests**

~~~js
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateAnalysis } = require("../lib/analysis-schema");

test("accepts every requested prediction category", () => {
  const result = validateAnalysis({
    matches: [{
      key: "m1", result: "主胜", handicap: "让负", goals: ["2球", "3球"],
      scores: ["1:1", "2:1", "1:0"], halfFull: ["平胜", "胜胜"],
      confidence: "中", evidence: ["排名更高"], risks: ["样本较少"],
    }],
  });
  assert.equal(result.matches[0].halfFull[0], "平胜");
});

test("rejects nonstandard half full time results", () => {
  assert.throws(() => validateAnalysis({ matches: [{ halfFull: ["主胜"] }] }), /halfFull/);
});
~~~

- [ ] **Step 2: Verify failure**

Run: node --test test/analysis-schema.test.js

Expected: Cannot find module ../lib/analysis-schema.

- [ ] **Step 3: Implement JSON schema guard**

~~~js
const HALF_FULL = new Set(["胜胜", "胜平", "胜负", "平胜", "平平", "平负", "负胜", "负平", "负负"]);
const CONFIDENCE = new Set(["低", "中", "高"]);

function validateAnalysis(input) {
  if (!Array.isArray(input && input.matches)) throw new Error("matches is required");
  for (const match of input.matches) {
    if (!CONFIDENCE.has(match.confidence)) throw new Error("confidence is invalid");
    if (!Array.isArray(match.halfFull) || !match.halfFull.length ||
      match.halfFull.some((value) => !HALF_FULL.has(value))) throw new Error("halfFull is invalid");
    if (!Array.isArray(match.scores) || match.scores.length !== 3) throw new Error("scores must contain three values");
  }
  return input;
}

module.exports = { HALF_FULL, validateAnalysis };
~~~

- [ ] **Step 4: Implement analysis service**

Build one structured prompt containing tomorrow's normalized standings, tournament record, recent form, head-to-head data, and odds snapshot. Call the model only when OPENAI_API_KEY exists. Parse JSON, validate with validateAnalysis, and return date, slot, dataUpdatedAt, generatedAt, facts, and analysis. With no key, return status unavailable and reason analysis key is not configured; do not make a network request.

- [ ] **Step 5: Persist, schedule, and expose data**

Store raw source facts in analysis-raw-YYYY-MM-DD.json. Store validated output plus slot in analysis-YYYY-MM-DD.json. At Beijing 00:10, 04:10, 08:10, 12:10, 16:10, and 20:10, generate exactly once per slot; on startup, generate once when the current slot is missing. Add GET /api/match-analysis which returns the latest valid, stale, or unavailable payload without prompt text or secrets.

- [ ] **Step 6: Verify and commit**

Run: npm test

Expected: all time, schedule, live, and schema tests pass.

~~~bash
git add server.js lib/analysis-schema.js lib/analysis-service.js test/analysis-schema.test.js
git commit -m "Add scheduled World Cup analysis snapshots"
~~~

### Task 4: Merge pages into a tabbed workbench

**Files:**
- Create: public/tabs.js
- Create: public/live.js
- Create: public/analysis.js
- Create: public/submissions.js
- Create: test/tabs.test.js
- Modify: public/index.html
- Modify: public/app.js
- Delete: public/admin.html
- Delete: public/admin.js

- [ ] **Step 1: Write failing tab test**

~~~js
const test = require("node:test");
const assert = require("node:assert/strict");
const { activeTabNames } = require("../public/tabs");

test("selects exactly the requested tab", () => {
  assert.deepEqual(activeTabNames(["live", "analysis", "selection", "submissions"], "analysis"), {
    active: "analysis", inactive: ["live", "selection", "submissions"],
  });
});
~~~

- [ ] **Step 2: Verify failure**

Run: node --test test/tabs.test.js

Expected: Cannot find module ../public/tabs.

- [ ] **Step 3: Implement pure activation helper**

~~~js
function activeTabNames(tabNames, active) {
  if (!tabNames.includes(active)) throw new Error("unknown tab");
  return { active, inactive: tabNames.filter((name) => name !== active) };
}

function setActiveTab(root, tabName) {
  const state = activeTabNames([...root.querySelectorAll("[data-tab]")].map((item) => item.dataset.tab), tabName);
  root.querySelectorAll("[data-tab]").forEach((item) => {
    const on = item.dataset.tab === state.active;
    item.classList.toggle("is-active", on);
    item.setAttribute("aria-selected", String(on));
  });
  root.querySelectorAll("[data-panel]").forEach((item) => { item.hidden = item.dataset.panel !== state.active; });
  return state;
}

if (typeof module !== "undefined") module.exports = { activeTabNames };
window.setActiveTab = setActiveTab;
~~~

- [ ] **Step 4: Replace HTML shell**

Make index.html the sole page with tab buttons in exactly this order: 实时赛况, 明日情报, 明日选单, 选单结果. Add one panel per tab. Move selection markup into selection and move the current admin markup into submissions. Load the new modules after app.js. Delete admin.html and admin.js only after their behavior has moved.

- [ ] **Step 5: Preserve existing flows**

Move admin loading, filters, payer totals, grouping, and deletion into mountSubmissions(root). Keep the existing selection local-storage key and only display its fixed tray while selection is active.

- [ ] **Step 6: Verify and commit**

Run: npm test

Expected: tab test and prior backend tests pass.

~~~bash
git add public/index.html public/app.js public/tabs.js public/live.js public/analysis.js public/submissions.js public/admin.html public/admin.js test/tabs.test.js
git commit -m "Merge selection and records into World Cup tabs"
~~~

### Task 5: Render live and analysis data responsively

**Files:**
- Modify: public/live.js
- Modify: public/analysis.js
- Modify: public/styles.css
- Create: test/analysis-render.test.js

- [ ] **Step 1: Write failing prediction-card test**

~~~js
const test = require("node:test");
const assert = require("node:assert/strict");
const { analysisCardHtml } = require("../public/analysis");

test("shows all five prediction groups", () => {
  const html = analysisCardHtml({
    home: "A", away: "B",
    analysis: { result: "主胜", handicap: "让负", goals: ["2球"], scores: ["1:1", "2:1", "1:0"], halfFull: ["平胜"], confidence: "中", evidence: [], risks: [] },
  });
  ["胜平负", "让球胜平负", "总进球数", "比分", "半全场"].forEach((label) => assert.match(html, new RegExp(label)));
});
~~~

- [ ] **Step 2: Verify failure**

Run: node --test test/analysis-render.test.js

Expected: missing analysisCardHtml export.

- [ ] **Step 3: Implement rendering**

live.js fetches /api/live-matches on activation and every 60 seconds only while the tab is active; it renders score, status, minute, events, and stale time. analysis.js fetches /api/match-analysis on activation and exports analysisCardHtml. Each card shows statistics, all five prediction categories, confidence, three scores, one or two half/full options, evidence, risks, and generation time. Unavailable and stale results must be explicitly labeled.

- [ ] **Step 4: Add mobile-first styles**

Create a non-scrollable four-column tab bar, compact match and prediction cards, one-column small-screen layout, safe text wrapping, and selection-only bottom tray padding. No page-level horizontal scroll is permitted.

- [ ] **Step 5: Verify and commit**

Run: npm test

Start: npm start

Use the in-app browser at http://localhost:4318/ in desktop and mobile widths. Confirm document.documentElement.scrollWidth <= window.innerWidth for every tab.

~~~bash
git add public/live.js public/analysis.js public/styles.css test/analysis-render.test.js
git commit -m "Render live results and prediction cards"
~~~

### Task 6: Make deployment preserve data and secrets

**Files:**
- Create: test/deployment-config.test.js
- Modify: Dockerfile
- Modify: scripts/deploy-vps.sh
- Modify: DEPLOYMENT.md
- Modify: README.md

- [ ] **Step 1: Write failing deployment test**

~~~js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("deploy forwards an optional server-only analysis key", () => {
  const script = fs.readFileSync("scripts/deploy-vps.sh", "utf8");
  assert.match(script, /OPENAI_API_KEY/);
  assert.doesNotMatch(script, /sk-[A-Za-z0-9]/);
});
~~~

- [ ] **Step 2: Verify failure**

Run: node --test test/deployment-config.test.js

Expected: assertion failure for missing OPENAI_API_KEY.

- [ ] **Step 3: Update Docker and deploy script**

Copy lib into Docker. Pass OPENAI_API_KEY to the container only from the shell environment; never echo it. Keep the existing mounted DATA_DIR unchanged so analysis cache and submissions survive redeploy.

- [ ] **Step 4: Document exact deploy behavior**

Document an export of OPENAI_API_KEY before the existing one-line deploy command. Document that no key leaves only 明日情报 unavailable while other tabs run normally.

- [ ] **Step 5: Verify release and commit**

~~~bash
npm test
docker build -t shijiebei-test .
docker run --rm -d --name shijiebei-smoke -p 4319:4318 -e DATA_DIR=/tmp/data shijiebei-test
curl -fsS http://localhost:4319/api/live-matches
curl -fsS http://localhost:4319/api/match-analysis
docker rm -f shijiebei-smoke
git add Dockerfile scripts/deploy-vps.sh DEPLOYMENT.md README.md test/deployment-config.test.js
git commit -m "Document workbench analysis deployment"
git push origin main
~~~

Expected: tests pass, image builds, both endpoints return JSON, and no response exposes secrets.

## Plan Self-Review

- Spec coverage: Tasks 2 and 5 implement one-minute live results. Task 3 implements the four-hour, all-play prediction snapshots. Task 4 implements the requested tab order and submission-page merge. Task 6 implements VPS persistence and model-key deployment.
- Placeholder scan: every task lists files, red/green checks, implementation boundary, verification, and commit.
- Interface consistency: browser modules consume GET /api/live-matches and GET /api/match-analysis; analysis validation and rendering consistently use halfFull.

