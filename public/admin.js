const listEl = document.querySelector("#submissionList");
const summaryEl = document.querySelector("#payerSummary");
const refreshBtn = document.querySelector("#adminRefreshBtn");

const poolLabels = {
  nspf: "胜平负",
  spf: "让球胜平负",
  jqs: "总进球数",
  bqc: "半全场",
  bf: "比分",
};

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
  return [...groups.values()];
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
        <div class="payer-summary-item">
          <span>${escapeHtml(item.name)}</span>
          <strong>${item.amount.toFixed(2)} 元</strong>
          <em>${item.count} 单</em>
        </div>
      `).join("") : '<div class="payer-summary-empty">暂无提交</div>'}
    </div>
  `;
}

function render(submissions) {
  renderPayerSummary(submissions);
  if (!submissions.length) {
    listEl.innerHTML = '<div class="panel-empty">暂无提交记录</div>';
    return;
  }

  listEl.innerHTML = submissions.map((item) => `
    <article class="submission-card">
      <div class="submission-head">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <span>${formatTime(item.submittedAt)}</span>
        </div>
        <div class="submission-money">
          <span>${escapeHtml((item.passModes || []).join(" / ") || "-")}</span>
          <strong>${Number(item.payAmount || 0).toFixed(2)} 元</strong>
        </div>
        <button class="delete-submission" type="button" data-delete-id="${escapeHtml(item.id)}">删除</button>
      </div>
      <div class="submission-meta">
        <span>已选 ${item.selectedCount || 0}</span>
        <span>注数 ${item.ticketCount || 0}</span>
        <span>倍数 ${item.multiplier || 1}</span>
        <span>奖金 ${escapeHtml(item.bonusRange || "-")}</span>
      </div>
      <div class="submission-picks">
        ${groupSelectionsByMatch(item.selections).map((group) => `
          <section class="submission-match">
            <h3>${escapeHtml(group.matchNum)} ${escapeHtml(group.teams)}</h3>
            <div>
              ${group.picks.map((pick) => `
                <span>
                  ${escapeHtml(poolLabels[pick.pool] || pick.pool)} ${escapeHtml(pick.label)}
                  <b>${Number(pick.sp || 0).toFixed(2)}</b>
                </span>
              `).join("")}
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
    render(data.submissions || []);
  } catch (error) {
    listEl.innerHTML = `<div class="panel-empty">${escapeHtml(error.message || "读取失败")}</div>`;
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "刷新";
  }
}

refreshBtn.addEventListener("click", loadSubmissions);
listEl.addEventListener("click", async (event) => {
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
