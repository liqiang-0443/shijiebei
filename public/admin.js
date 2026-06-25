(function submissionsModule() {
const listEl = document.querySelector("#submissionList");
const summaryEl = document.querySelector("#payerSummary");
const refreshBtn = document.querySelector("#adminRefreshBtn");
const nameFilter = document.querySelector("#nameFilter");
const typeFilter = document.querySelector("#typeFilter");

let allSubmissions = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function matchSortValue(matchNum) {
  const digits = String(matchNum || "").match(/\d+/g);
  return digits && digits.length ? Number(digits[digits.length - 1]) : Number.POSITIVE_INFINITY;
}

function sortMatchGroups(a, b) {
  const diff = matchSortValue(a.matchNum) - matchSortValue(b.matchNum);
  if (diff) return diff;
  return String(a.teams || "").localeCompare(String(b.teams || ""), "zh-CN");
}

function payerName(item) {
  return item.name || "未命名";
}

function sortSubmissionsByName(submissions) {
  return [...submissions].sort((a, b) => (
    payerName(a).localeCompare(payerName(b), "zh-CN")
    || new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0)
  ));
}

function groupSelectionsByMatch(selections) {
  const groups = new Map();
  (selections || []).forEach((pick) => {
    const key = pick.matchKey || `${pick.matchNum}-${pick.teams}`;
    if (!groups.has(key)) {
      groups.set(key, {
        matchNum: pick.matchNum,
        teams: pick.teams,
        picks: [],
      });
    }
    groups.get(key).picks.push(pick);
  });
  return [...groups.values()].sort(sortMatchGroups);
}

function splitTeams(teams) {
  const parts = String(teams || "").split(/\s+VS\s+/i);
  return { home: parts[0] || teams || "-", away: parts[1] || "" };
}

function passModeValues(modes) {
  return (modes || []).map((mode) => {
    if (mode === "单关") return 1;
    const match = String(mode).match(/(\d+)\s*串\s*1/);
    return match ? Number(match[1]) : null;
  }).filter(Boolean);
}

function calculatedBonusRange(item) {
  if (!globalThis.WorldCupBetting || !item.selections?.length) return item.bonusRange || "-";
  const modes = passModeValues(item.passModes);
  if (!modes.length) return item.bonusRange || "-";
  const range = globalThis.WorldCupBetting.estimateBonusRange(item.selections, modes, item.multiplier || 1);
  return `${range.minBonus.toFixed(2)} - ${range.maxBonus.toFixed(2)}`;
}

function choiceLabel(pick) {
  const label = String(pick.label || "").trim();
  if (!label) return "";
  const pool = String(pick.pool || "").toLowerCase();
  if ((pool === "spf" || pool === "rqspf") && !label.includes("【让】")) {
    return `${label}【让】`;
  }
  return label;
}

function choiceText(picks) {
  return picks.map(choiceLabel).filter(Boolean).join(",") || "-";
}

function passModeBadges(modes) {
  const values = modes && modes.length ? modes : ["-"];
  return `<div class="pass-mode-badges">${values.map((mode) => `<span>${escapeHtml(mode)}</span>`).join("")}</div>`;
}

function populateFilters(submissions) {
  const currentName = nameFilter.value;
  const currentType = typeFilter.value;
  const names = [...new Set(submissions.map((item) => item.name || "未命名"))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const types = [...new Set(submissions.flatMap((item) => item.passModes || []))].sort((a, b) => a.localeCompare(b, "zh-CN"));

  nameFilter.innerHTML = `<option value="">全部</option>${names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
  typeFilter.innerHTML = `<option value="">全部</option>${types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("")}`;

  nameFilter.value = names.includes(currentName) ? currentName : "";
  typeFilter.value = types.includes(currentType) ? currentType : "";
}

function filteredSubmissions() {
  const name = nameFilter.value;
  const type = typeFilter.value;
  return sortSubmissionsByName(allSubmissions).filter((item) => {
    const nameOk = !name || (item.name || "未命名") === name;
    const typeOk = !type || (item.passModes || []).includes(type);
    return nameOk && typeOk;
  });
}

function applyFilters() {
  render(filteredSubmissions());
}

function toggleNameFilter(name) {
  nameFilter.value = nameFilter.value === name ? "" : name;
  applyFilters();
}

function renderPayerSummary(submissions) {
  const summary = new Map();
  submissions.forEach((item) => {
    const name = item.name || "未命名";
    const current = summary.get(name) || { name, count: 0, amount: 0 };
    current.count += 1;
    current.amount += Number(item.payAmount || 0);
    summary.set(name, current);
  });

  const rows = [...summary.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "zh-CN"));
  const total = rows.reduce((sum, item) => sum + item.amount, 0);

  summaryEl.innerHTML = `
    <div class="payer-summary-head">
      <strong>今日应付汇总</strong>
      <span>合计 ${total.toFixed(2)} 元</span>
    </div>
    <div class="payer-summary-list">
      ${rows.length ? rows.map((item) => `
        <button class="payer-summary-item" type="button" data-filter-name="${escapeHtml(item.name)}">
          <span>${escapeHtml(item.name)}</span>
          <strong>${item.amount.toFixed(2)} 元</strong>
          <em>${item.count} 单</em>
        </button>
      `).join("") : '<div class="payer-summary-empty">暂无提交</div>'}
    </div>
  `;
}

function render(submissions) {
  renderPayerSummary(allSubmissions);
  if (!submissions.length) {
    listEl.innerHTML = '<div class="panel-empty">暂无提交记录</div>';
    return;
  }

  listEl.innerHTML = submissions.map((item) => `
    <article class="submission-card submission-ticket">
      <div class="submission-head ticket-head">
        <div>
          <button class="submission-name" type="button" data-filter-name="${escapeHtml(payerName(item))}">${escapeHtml(payerName(item))}</button>
          <span>${formatTime(item.submittedAt)}</span>
        </div>
        <div class="submission-money">
          ${passModeBadges(item.passModes)}
          <strong>${Number(item.payAmount || 0).toFixed(2)} 元</strong>
        </div>
        <button class="delete-submission" type="button" data-delete-id="${escapeHtml(item.id)}">删除</button>
      </div>
      <div class="submission-meta">
        <span>已选 ${item.selectedCount || 0}</span>
        <span>注数 ${item.ticketCount || 0}</span>
        <span class="multiplier-pill">倍数 <b>${item.multiplier || 1}</b></span>
        <span>奖金 ${escapeHtml(calculatedBonusRange(item))}</span>
      </div>
      <div class="submission-picks">
        ${groupSelectionsByMatch(item.selections).map((group) => `
          <section class="submission-match ticket-match-row">
            <h3 class="ticket-match-code"><em>${escapeHtml(String(group.matchNum || "").replace(/[^\d]/g, "") || group.matchNum)}</em><span>${escapeHtml(group.teams)}</span></h3>
            <div class="ticket-choice-box">
              <span class="ticket-choice-text">${escapeHtml(choiceText(group.picks))}</span>
            </div>
          </section>
        `).join("")}
      </div>
    </article>
  `).join("");
}

async function loadSubmissions() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "读取中";
  try {
    const response = await fetch("/api/submissions", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "读取失败");
    allSubmissions = data.submissions || [];
    populateFilters(allSubmissions);
    applyFilters();
  } catch (error) {
    listEl.innerHTML = `<div class="panel-empty">${escapeHtml(error.message || "读取失败")}</div>`;
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "刷新";
  }
}

refreshBtn.addEventListener("click", loadSubmissions);
nameFilter.addEventListener("change", applyFilters);
typeFilter.addEventListener("change", applyFilters);
document.querySelector(".workbench")?.addEventListener("worldcup:tabchange", (event) => {
  if (event.detail.active === "submissions") loadSubmissions();
});
summaryEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter-name]");
  if (!button) return;
  toggleNameFilter(button.dataset.filterName);
});
listEl.addEventListener("click", async (event) => {
  const filterButton = event.target.closest("[data-filter-name]");
  if (filterButton) {
    toggleNameFilter(filterButton.dataset.filterName);
    return;
  }
  const button = event.target.closest("[data-delete-id]");
  if (!button) return;
  const confirmed = window.confirm("确认删除这条提交记录？");
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "删除中";
  try {
    const response = await fetch(`/api/submissions/${encodeURIComponent(button.dataset.deleteId)}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "删除失败");
    await loadSubmissions();
  } catch (error) {
    button.disabled = false;
    button.textContent = "删除";
    alert(error.message || "删除失败");
  }
});
loadSubmissions();
})();
