(function liveModule() {
  const statusLabels = {
    scheduled: "未开赛",
    first_half: "上半场",
    halftime: "中场",
    second_half: "下半场",
    live: "进行中",
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

  function liveCardHtml(match) {
    const status = statusLabels[match.status] || "未开赛";
    const progress = match.progressText || (match.minute ? `${status} ${match.minute}'` : status);
    const events = (match.events || []).map((event) => `<li>${escapeHtml(event.minute || "")} ${escapeHtml(event.type || "")} ${escapeHtml(event.text || "")}</li>`).join("");
    const live = ["first_half", "halftime", "second_half", "live"].includes(match.status);
    const kickoff = String(match.scheduledAt || "").slice(11) || "-";
    return `<article class="live-scoreboard ${live ? "is-live" : ""}"><time class="live-kickoff">${escapeHtml(kickoff)}</time><div class="live-team live-home">${escapeHtml(match.home)}</div><strong class="live-score">${match.score?.home ?? 0} : ${match.score?.away ?? 0}</strong><div class="live-team live-away">${escapeHtml(match.away)}</div><span class="live-status ${escapeHtml(match.status)}">${escapeHtml(progress)}</span>${events ? `<ul class="live-events">${events}</ul>` : ""}</article>`;
  }

  if (typeof module !== "undefined") module.exports = { liveCardHtml };
  if (typeof document === "undefined") return;
  const listEl = document.querySelector("#liveMatchList");
  const updatedEl = document.querySelector("#liveUpdatedAt");
  const refreshBtn = document.querySelector("#liveRefreshBtn");

  async function loadLive(manual = false) {
    if (!listEl) return;
    if (manual && refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.classList.add("is-loading");
    }
    try {
      const response = await fetch(manual ? "/api/live-matches/refresh" : "/api/live-matches", { cache: "no-store" });
      const data = await response.json();
      updatedEl.textContent = data.updatedAt ? `最近同步 ${formatTime(data.updatedAt)}${data.stale ? "，数据暂未更新" : ""}` : (data.error || "暂无赛况");
      listEl.innerHTML = data.matches?.length ? data.matches.map(liveCardHtml).join("") : '<div class="panel-empty">今日暂无世界杯比赛</div>';
    } catch (error) {
      listEl.innerHTML = `<div class="panel-empty">${escapeHtml(error.message || "读取赛况失败")}</div>`;
    } finally {
      if (manual && refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.classList.remove("is-loading");
      }
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
    refreshBtn?.addEventListener("click", () => loadLive(true));
    root.addEventListener("worldcup:tabchange", (event) => {
      if (event.detail.active === "live") start(); else stop();
    });
  });
})();
