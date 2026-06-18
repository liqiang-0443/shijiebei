const STORAGE_KEY = "worldcup-odds-poc-selection";

function readStoredState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      selected: new Map((parsed.selected || []).map((item) => [item.key, item])),
      passModes: new Set(parsed.passModes || [1]),
    };
  } catch {
    return { selected: new Map(), passModes: new Set([1]) };
  }
}

const storedState = readStoredState();

const state = {
  matches: [],
  fetchedAt: "",
  ok: false,
  error: null,
  selected: storedState.selected,
  passModes: storedState.passModes,
};

const el = {
  refreshBtn: document.querySelector("#refreshBtn"),
  statusText: document.querySelector("#statusText"),
  matchCount: document.querySelector("#matchCount"),
  updatedAt: document.querySelector("#updatedAt"),
  searchInput: document.querySelector("#searchInput"),
  typeSelect: document.querySelector("#typeSelect"),
  multiplierInput: document.querySelector("#multiplierInput"),
  selectedCount: document.querySelector("#selectedCount"),
  ticketCount: document.querySelector("#ticketCount"),
  payAmount: document.querySelector("#payAmount"),
  bonusRange: document.querySelector("#bonusRange"),
  passModes: document.querySelector("#passModes"),
  selectedPreview: document.querySelector("#selectedPreview"),
  clearSelectionBtn: document.querySelector("#clearSelectionBtn"),
  nameSelect: document.querySelector("#nameSelect"),
  customNameInput: document.querySelector("#customNameInput"),
  submitBetBtn: document.querySelector("#submitBetBtn"),
  submitStatus: document.querySelector("#submitStatus"),
  matchList: document.querySelector("#matchList"),
  matchBody: document.querySelector("#matchBody"),
};

const valueLabels = { 3: "胜", 1: "平", 0: "负" };
const poolLabels = {
  nspf: "胜平负",
  spf: "让球胜平负",
  jqs: "总进球数",
  bqc: "半全场",
  bf: "比分",
};

const optionLabels = {
  nspf: { 3: "胜", 1: "平", 0: "负" },
  spf: { 3: "让胜", 1: "让平", 0: "让负" },
  jqs: { 0: "0球", 1: "1球", 2: "2球", 3: "3球", 4: "4球", 5: "5球", 6: "6球", 7: "7+" },
  bqc: {
    "3-3": "胜胜",
    "3-1": "胜平",
    "3-0": "胜负",
    "1-3": "平胜",
    "1-1": "平平",
    "1-0": "平负",
    "0-3": "负胜",
    "0-1": "负平",
    "0-0": "负负",
  },
};

const poolOrder = {
  nspf: ["3", "1", "0"],
  spf: ["3", "1", "0"],
  jqs: ["0", "1", "2", "3", "4", "5", "6", "7"],
  bqc: ["3-3", "3-1", "3-0", "1-3", "1-1", "1-0", "0-3", "0-1", "0-0"],
  bf: [
    "1:0", "2:0", "2:1", "3:0", "3:1", "3:2", "4:0", "4:1", "4:2", "5:0", "5:1", "5:2",
    "胜其他", "0:0", "1:1", "2:2", "3:3", "平其他",
    "0:1", "0:2", "1:2", "0:3", "1:3", "2:3", "0:4", "1:4", "2:4", "0:5", "1:5", "2:5", "负其他",
  ],
};

function formatTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function changeClass(change) {
  if (!change || !change.before) return "";
  if (change.delta > 0) return "up";
  if (change.delta < 0) return "down";
  return "";
}

function displayLabel(type, value) {
  return optionLabels[type]?.[value] || value;
}

function selectionKey(match, type, value) {
  return `${match.key}::${type}::${value}`;
}

function normalizeMultiplier() {
  const value = Math.floor(Number(el.multiplierInput.value));
  const multiplier = Number.isFinite(value) && value > 0 ? Math.min(value, 9999) : 1;
  el.multiplierInput.value = String(multiplier);
  return multiplier;
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    selected: [...state.selected.values()],
    passModes: [...state.passModes],
  }));
}

function getSelectionIndex(matches) {
  const index = new Map();
  matches.forEach((match) => {
    Object.keys(match.odds || {}).forEach((pool) => {
      Object.keys(match.odds[pool] || {}).forEach((value) => {
        const key = selectionKey(match, pool, value);
        index.set(key, {
          key,
          matchKey: match.key,
          matchNum: match.matchNum,
          teams: `${match.home} VS ${match.away}`,
          pool,
          value,
          label: displayLabel(pool, value),
          sp: Number(match.odds[pool][value]),
          single: Boolean(match.single?.[pool]),
        });
      });
    });
  });
  return index;
}

function reconcileSelections(matches) {
  const valid = getSelectionIndex(matches);
  for (const key of [...state.selected.keys()]) {
    if (valid.has(key)) {
      state.selected.set(key, valid.get(key));
    } else {
      state.selected.delete(key);
    }
  }
  normalizePassModes();
}

function groupSelections(selections) {
  const groups = new Map();
  selections.forEach((item) => {
    if (!groups.has(item.matchKey)) groups.set(item.matchKey, []);
    groups.get(item.matchKey).push(item);
  });
  return [...groups.values()];
}

function combinations(items, size) {
  const out = [];
  const walk = (start, picked) => {
    if (picked.length === size) {
      out.push([...picked]);
      return;
    }
    for (let index = start; index <= items.length - (size - picked.length); index += 1) {
      picked.push(items[index]);
      walk(index + 1, picked);
      picked.pop();
    }
  };
  walk(0, []);
  return out;
}

function buildTickets(selections) {
  const modes = [...state.passModes].sort((a, b) => a - b);
  const grouped = groupSelections(selections);
  const tickets = [];

  if (modes.includes(1)) {
    selections.filter((item) => item.single).forEach((item) => {
      tickets.push({ mode: 1, odds: item.sp });
    });
  }

  modes.filter((mode) => mode > 1).forEach((mode) => {
    combinations(grouped, mode).forEach((groupSet) => {
      const walk = (index, odds) => {
        if (index === groupSet.length) {
          tickets.push({ mode, odds });
          return;
        }
        groupSet[index].forEach((item) => walk(index + 1, odds * item.sp));
      };
      walk(0, 1);
    });
  });

  return tickets;
}

function availablePassModes() {
  const selections = [...state.selected.values()];
  const matchCount = groupSelections(selections).length;
  const modes = [];
  if (selections.some((item) => item.single)) modes.push(1);
  for (let mode = 2; mode <= Math.min(4, matchCount); mode += 1) {
    modes.push(mode);
  }
  return modes;
}

function passModeLabel(mode) {
  return mode === 1 ? "单关" : `${mode}串1`;
}

function normalizePassModes() {
  const available = availablePassModes();
  const availableSet = new Set(available);
  for (const mode of [...state.passModes]) {
    if (!availableSet.has(mode)) state.passModes.delete(mode);
  }
  if (!state.passModes.size && available.length) {
    state.passModes.add(available[0]);
  }
}

function renderPassModes() {
  normalizePassModes();
  const available = new Set(availablePassModes());
  const maxModes = [1, 2, 3, 4];
  el.passModes.innerHTML = maxModes.map((mode) => {
    const enabled = available.has(mode);
    const active = state.passModes.has(mode);
    return `<button class="pass-mode ${active ? "active" : ""}" type="button" data-pass-mode="${mode}" ${enabled ? "" : "disabled"}>${passModeLabel(mode)}</button>`;
  }).join("");
}

function renderSelectedPreview() {
  const selections = [...state.selected.values()];
  if (!selections.length) {
    el.selectedPreview.innerHTML = '<span class="empty-preview">还没有选择玩法</span>';
    return;
  }
  el.selectedPreview.innerHTML = selections.map((item) => `
    <button class="selected-chip" type="button" data-remove-key="${escapeHtml(item.key)}">
      <span class="chip-match">${escapeHtml(item.matchNum)} ${escapeHtml(item.teams)}</span>
      <strong>${escapeHtml(poolLabels[item.pool] || item.pool)} ${escapeHtml(item.label)}</strong>
      <em>${item.sp.toFixed(2)}</em>
    </button>
  `).join("");
}

function updateSummary() {
  const selections = [...state.selected.values()];
  const multiplier = normalizeMultiplier();
  normalizePassModes();
  persistState();
  const tickets = buildTickets(selections);
  const pay = tickets.length * 2 * multiplier;
  const bonuses = tickets.map((ticket) => ticket.odds * 2 * multiplier);
  const minBonus = bonuses.length ? Math.min(...bonuses) : 0;
  const maxBonus = bonuses.reduce((sum, value) => sum + value, 0);

  el.selectedCount.textContent = String(selections.length);
  el.ticketCount.textContent = String(tickets.length);
  el.payAmount.textContent = formatMoney(pay);
  el.bonusRange.textContent = `${formatMoney(minBonus)} - ${formatMoney(maxBonus)}`;
  el.clearSelectionBtn.disabled = selections.length === 0;
  const hasName = Boolean(getSubmitName());
  el.submitBetBtn.disabled = selections.length === 0 || tickets.length === 0 || !hasName;
  if (selections.length && tickets.length && !hasName && !el.submitStatus.textContent) {
    setSubmitStatus("请选择姓名", "hint");
  }
}

function setSubmitStatus(message, type = "") {
  el.submitStatus.textContent = message;
  el.submitStatus.className = `submit-status ${type}`.trim();
}

function getSubmitName() {
  const selected = el.nameSelect.value;
  if (selected === "custom") return el.customNameInput.value.trim();
  return selected.trim();
}

function submissionPayload() {
  const selections = [...state.selected.values()];
  const tickets = buildTickets(selections);
  return {
    name: getSubmitName(),
    multiplier: normalizeMultiplier(),
    passModes: [...state.passModes].sort((a, b) => a - b).map(passModeLabel),
    selectedCount: selections.length,
    ticketCount: tickets.length,
    payAmount: Number(el.payAmount.textContent) || 0,
    bonusRange: el.bonusRange.textContent,
    selections,
  };
}

async function submitBet() {
  const payload = submissionPayload();
  if (!payload.name) {
    setSubmitStatus("请选择或填写姓名", "error");
    return;
  }
  if (!payload.selections.length || !payload.ticketCount) {
    setSubmitStatus("请先选择有效玩法", "error");
    return;
  }

  el.submitBetBtn.disabled = true;
  setSubmitStatus("提交中", "hint");
  try {
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "提交失败");
    state.selected.clear();
    state.passModes.clear();
    persistState();
    render();
    setSubmitStatus("提交成功，后台已记录", "success");
  } catch (error) {
    setSubmitStatus(error.message || "提交失败", "error");
  } finally {
    updateSummary();
  }
}

function deltaText(change) {
  if (!change || !change.before || !change.delta) return "";
  const sign = change.delta > 0 ? "+" : "";
  return `<span class="delta">${sign}${change.delta.toFixed(2)}</span>`;
}

function sortValues(type, odds) {
  const preferred = poolOrder[type] || [];
  const keys = Object.keys(odds || {});
  return [
    ...preferred.filter((key) => keys.includes(key)),
    ...keys.filter((key) => !preferred.includes(key)).sort((a, b) => a.localeCompare(b, "zh-CN")),
  ];
}

function oddsCells(match, type, compact = false) {
  const odds = match.odds[type] || {};
  if (!Object.keys(odds).length) return '<span class="time">未开售</span>';
  const single = Boolean(match.single?.[type]);
  return `
    <div class="odds-row ${compact ? "odds-row-compact" : ""}">
      ${sortValues(type, odds).map((value) => {
        const sp = odds[value];
        const change = match.changes?.[`${type}_${value}`];
        const key = selectionKey(match, type, value);
        const selected = state.selected.has(key);
        return `
          <button class="odd ${changeClass(change)} ${selected ? "selected" : ""}" type="button"
            data-select-key="${escapeHtml(key)}"
            data-match-key="${escapeHtml(match.key)}"
            data-match-num="${escapeHtml(match.matchNum)}"
            data-teams="${escapeHtml(`${match.home} VS ${match.away}`)}"
            data-pool="${escapeHtml(type)}"
            data-value="${escapeHtml(value)}"
            data-label="${escapeHtml(displayLabel(type, value))}"
            data-sp="${escapeHtml(sp)}"
            data-single="${single ? "1" : "0"}">
            ${single ? '<em class="single-badge odd-single">单</em>' : ""}
            <label>${escapeHtml(displayLabel(type, value))}</label>
            <strong>${Number.isFinite(sp) ? sp.toFixed(2) : "-"}</strong>${deltaText(change)}
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function filteredMatches() {
  const query = el.searchInput?.value.trim().toLowerCase() || "";
  const type = el.typeSelect.value;
  return state.matches.filter((match) => {
    const haystack = `${match.matchNum} ${match.league} ${match.home} ${match.away}`.toLowerCase();
    const typeOk = type === "all" || type === "mixed" || Object.keys(match.odds[type] || {}).length;
    return typeOk && (!query || haystack.includes(query));
  });
}

function visiblePools() {
  const selected = el.typeSelect.value;
  if (selected === "all") return ["nspf", "spf", "jqs", "bqc", "bf"];
  if (selected === "mixed") return ["nspf", "spf", "jqs", "bqc", "bf"];
  return [selected];
}

function renderMatchCards(rows) {
  const pools = visiblePools();
  el.matchList.innerHTML = rows.map((match) => `
    <article class="match-card">
      <div class="match-head">
        <div>
          <div class="meta-line">
            <span class="match-num">${escapeHtml(match.matchNum)}</span>
            <span class="league">${escapeHtml(match.league || "-")}</span>
            <span class="rq">让 ${escapeHtml(match.rangqiu || "0")}</span>
          </div>
          <h2>${escapeHtml(match.home)} <span>VS</span> ${escapeHtml(match.away)}</h2>
        </div>
        <div class="match-time">
          <strong>${escapeHtml(match.matchDate)} ${escapeHtml(match.matchTime)}</strong>
          <span>截止 ${escapeHtml(match.buyEndTime || "-")}</span>
        </div>
      </div>
      <div class="pool-grid">
        ${pools.map((pool) => `
          <section class="pool-panel pool-${pool} ${pool === "bf" ? "pool-wide" : ""}">
            <h3>${poolLabels[pool]}${match.single?.[pool] ? '<em class="single-badge pool-single">单</em>' : ""}</h3>
            ${oddsCells(match, pool, pool !== "nspf" && pool !== "spf")}
          </section>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function render() {
  el.statusText.textContent = state.ok ? "正常" : "异常";
  el.matchCount.textContent = String(state.matches.length || 0);
  el.updatedAt.textContent = formatTime(state.fetchedAt);
  renderPassModes();
  renderSelectedPreview();
  updateSummary();

  const rows = filteredMatches();
  if (!rows.length) {
    el.matchList.innerHTML = `<div class="empty panel-empty">${state.error ? escapeHtml(state.error) : "没有匹配的比赛"}</div>`;
    el.matchBody.innerHTML = `<tr><td colspan="6" class="empty">${state.error ? escapeHtml(state.error) : "没有匹配的比赛"}</td></tr>`;
    return;
  }

  renderMatchCards(rows);
  el.matchBody.innerHTML = rows.map((match) => `
    <tr>
      <td><span class="match-num">${escapeHtml(match.matchNum)}</span></td>
      <td><span class="league">${escapeHtml(match.league || "-")}</span></td>
      <td>
        <div class="teams">
          <strong>${escapeHtml(match.home)} VS ${escapeHtml(match.away)}</strong>
          <span>${escapeHtml(match.matchDate)} ${escapeHtml(match.matchTime)}</span>
        </div>
      </td>
      <td><span class="time">${escapeHtml(match.buyEndTime || "-")}</span></td>
      <td>${oddsCells(match, "nspf")}</td>
      <td><span class="rq">${escapeHtml(match.rangqiu || "0")}</span>${oddsCells(match, "spf")}</td>
    </tr>
  `).join("");
}

async function loadData(force = false) {
  el.refreshBtn.disabled = true;
  el.refreshBtn.textContent = force ? "刷新中" : "读取中";
  try {
    const response = await fetch(force ? "/api/refresh" : "/api/matches", { cache: "no-store" });
    const data = await response.json();
    Object.assign(state, data);
    reconcileSelections(state.matches);
  } catch (error) {
    state.ok = false;
    state.error = error.message || String(error);
  } finally {
    el.refreshBtn.disabled = false;
    el.refreshBtn.textContent = "刷新";
    render();
    updateSummary();
  }
}

el.refreshBtn.addEventListener("click", () => loadData(true));
el.searchInput?.addEventListener("input", render);
el.typeSelect.addEventListener("change", render);
el.multiplierInput.addEventListener("input", updateSummary);
el.nameSelect.addEventListener("change", () => {
  el.customNameInput.classList.toggle("show", el.nameSelect.value === "custom");
  setSubmitStatus("");
  updateSummary();
});
el.customNameInput.addEventListener("input", () => {
  setSubmitStatus("");
  updateSummary();
});
el.submitBetBtn.addEventListener("click", submitBet);
el.passModes.addEventListener("click", (event) => {
  const button = event.target.closest("[data-pass-mode]");
  if (!button || button.disabled) return;
  const mode = Number(button.dataset.passMode);
  if (state.passModes.has(mode)) {
    state.passModes.delete(mode);
  } else {
    state.passModes.add(mode);
  }
  render();
});
el.selectedPreview.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-key]");
  if (!button) return;
  state.selected.delete(button.dataset.removeKey);
  render();
});
el.clearSelectionBtn.addEventListener("click", () => {
  state.selected.clear();
  setSubmitStatus("");
  render();
  updateSummary();
});
el.matchList.addEventListener("click", (event) => {
  const button = event.target.closest(".odd");
  if (!button) return;
  const single = button.dataset.single === "1";
  const key = button.dataset.selectKey;
  if (state.selected.has(key)) {
    state.selected.delete(key);
  } else {
    state.selected.set(key, {
      key,
      matchKey: button.dataset.matchKey,
      matchNum: button.dataset.matchNum,
      teams: button.dataset.teams,
      pool: button.dataset.pool,
      value: button.dataset.value,
      label: button.dataset.label,
      sp: Number(button.dataset.sp),
      single,
    });
  }
  setSubmitStatus("");
  render();
  updateSummary();
});

el.customNameInput.classList.toggle("show", el.nameSelect.value === "custom");
loadData();
setInterval(loadData, 60 * 1000);
