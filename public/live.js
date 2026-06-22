(function liveModule() {
  const statusLabels = {
    scheduled: "未开赛",
    first_half: "上半场",
    halftime: "中场",
    second_half: "下半场",
    finished: "完场",
    postponed: "延期",
  };
  let timer = null;

  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function formatTime(value) {
    if (!value) return "-";
    return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  }

  function cardHtml(match) {
    const status = statusLabels[match.status] || "未开赛";
    const progress = match.progressText || (match.minute ? `${status} ${match.minute}'` : status);
    const events = (match.events || []).map((event) => `<li>${escapeHtml(event.minute || "")} ${escapeHtml(event.type || "")} ${escapeHtml(event.text || "")}</li>`).join("");
    return `<article class="live-card"><header><span class="match-code">${escapeHtml(match.matchNum || "-")}</span><span class="live-status ${escapeHtml(match.status)}">${escapeHtml(progress)}</span></header><h2>${escapeHtml(match.home)} <strong>${match.score?.home ?? 0} : ${match.score?.away ?? 0}</strong> ${escapeHtml(match.away)}</h2><p>${escapeHtml(match.scheduledAt || "")}</p>${events ? `<ul class="live-events">${events}</ul>` : ""}</article>`;
  }

  if (typeof document === "undefined") return;
  const listEl = document.querySelector("#liveMatchList");
  const updatedEl = document.querySelector("#liveUpdatedAt");

  async function loadLive() {
    if (!listEl) return;
    try {
      const response = await fetch("/api/live-matches", { cache: "no-store" });
      const data = await response.json();
      updatedEl.textContent = data.updatedAt ? `最近同步 ${formatTime(data.updatedAt)}${data.stale ? "，数据暂未更新" : ""}` : (data.error || "暂无赛况");
      listEl.innerHTML = data.matches?.length ? data.matches.map(cardHtml).join("") : '<div class="panel-empty">今日暂无世界杯比赛</div>';
    } catch (error) {
      listEl.innerHTML = `<div class="panel-empty">${escapeHtml(error.message || "读取赛况失败")}</div>`;
    }
  }

  function start() {
    loadLive();
    if (!timer) timer = setInterval(loadLive, 60000);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  window.addEventListener("DOMContentLoaded", () => {
    const root = document.querySelector(".workbench");
    if (!root) return;
    start();
    root.addEventListener("worldcup:tabchange", (event) => {
      if (event.detail.active === "live") start(); else stop();
    });
  });
})();
