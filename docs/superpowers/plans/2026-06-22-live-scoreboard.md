# Live Scoreboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the live tab cards with a responsive FIFA scoreboard and add immediate manual refresh.

**Architecture:** Keep `live.js` responsible for rendering and polling, add one heading button in `index.html`, and scope the visual changes to live-scoreboard CSS. The existing `/api/live-matches` endpoint remains the sole data contract.

**Tech Stack:** Vanilla JavaScript, CSS Grid, Node test runner.

---

### Task 1: Render Compact Live Rows

**Files:**
- Modify: `public/live.js`
- Test: `test/live-render.test.js`

- [ ] **Step 1: Write the failing test**

```js
test("renders a live score row without an unused match number", () => {
  const html = liveCardHtml({ home: "西班牙", away: "沙特", score: { home: 4, away: 0 }, status: "finished", scheduledAt: "2026-06-22 00:00" });
  assert.doesNotMatch(html, /match-code/);
  assert.match(html, /live-scoreboard/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/live-render.test.js`
Expected: FAIL because `liveCardHtml` is not exported.

- [ ] **Step 3: Implement the pure row renderer and use it from `loadLive`**

```js
function liveCardHtml(match) {
  return `<article class="live-scoreboard">...</article>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/live-render.test.js`
Expected: PASS.

### Task 2: Add Manual Refresh Control

**Files:**
- Modify: `public/index.html`
- Modify: `public/live.js`
- Test: `test/live-render.test.js`

- [ ] **Step 1: Write the failing test**

```js
test("exposes a callable live refresh function", async () => {
  assert.equal(typeof liveModule.refreshLive, "function");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/live-render.test.js`
Expected: FAIL because the refresh function is absent.

- [ ] **Step 3: Add `#liveRefreshBtn` and bind it to `loadLive(true)`**

```js
refreshButton.addEventListener("click", () => loadLive(true));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/live-render.test.js`
Expected: PASS.

### Task 3: Style and Verify

**Files:**
- Modify: `public/styles.css`
- Test: `test/live-render.test.js`

- [ ] **Step 1: Add stable live scoreboard grid styles**

```css
.live-scoreboard { grid-template-columns: 56px minmax(0, 1fr) auto minmax(0, 1fr); }
```

- [ ] **Step 2: Run full verification**

Run: `node --test`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add public/index.html public/live.js public/styles.css test/live-render.test.js docs/superpowers
git commit -m "Polish live scoreboard and refresh control"
```
