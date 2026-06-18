const listEl = document.querySelector("#submissionList");
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
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function render(submissions) {
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
        ${(item.selections || []).map((pick) => `
          <span>
            ${escapeHtml(pick.matchNum)} ${escapeHtml(pick.teams)}
            <b>${escapeHtml(poolLabels[pick.pool] || pick.pool)} ${escapeHtml(pick.label)} ${Number(pick.sp || 0).toFixed(2)}</b>
          </span>
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
