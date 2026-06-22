(function analysisModule() {
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

  function predictionHtml(label, values, emphasis = false) {
    const list = Array.isArray(values) ? values : [values];
    return `<div class="prediction-item"><span>${escapeHtml(label)}</span><strong class="${emphasis ? "prediction-emphasis" : ""}">${list.map(escapeHtml).join(" / ")}</strong></div>`;
  }

  function infoList(items) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) return `<em>暂无</em>`;
    return `<ul>${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function intelligenceHtml(statistics, dataGaps) {
    const stats = statistics || {};
    const ranking = stats.worldCupRanking;
    const record = stats.tournamentRecord;
    const recent = stats.recentForm || {};
    const gaps = Array.isArray(dataGaps) ? dataGaps : [];
    return `<section class="intel-panel">
      <div><span>世界杯排名</span><strong>${ranking ? `${escapeHtml(ranking.home)} / ${escapeHtml(ranking.away)}` : "暂无"}</strong></div>
      <div><span>本届战绩</span><strong>${record ? `${escapeHtml(record.home)} / ${escapeHtml(record.away)}` : "暂无"}</strong></div>
      <div><span>近期赛果</span>${infoList([...(recent.home || []), ...(recent.away || [])].slice(0, 4))}</div>
      <div><span>历史交锋</span>${infoList(stats.headToHead)}</div>
      ${gaps.length ? `<p>${gaps.map(escapeHtml).join("；")}</p>` : ""}
    </section>`;
  }

  function analysisCardHtml(fact) {
    const analysis = fact.analysis;
    if (!analysis) {
      return `<article class="analysis-card"><header><span class="match-code">${escapeHtml(fact.matchNum || "-")}</span><h2>${escapeHtml(fact.home)} VS ${escapeHtml(fact.away)}</h2></header><p class="analysis-unavailable">本场分析尚未生成。</p></article>`;
    }
    return `<article class="analysis-card">
      <header><span class="match-code">${escapeHtml(fact.matchNum || "-")}</span><h2>${escapeHtml(fact.home)} VS ${escapeHtml(fact.away)}</h2><em>信心 ${escapeHtml(analysis.confidence)}</em></header>
      <p class="analysis-meta">${escapeHtml(fact.matchDate || "")} ${escapeHtml(fact.matchTime || "")} ${fact.handicap ? `让球 ${escapeHtml(fact.handicap)}` : ""}</p>
      ${intelligenceHtml(fact.statistics, fact.dataGaps)}
      <div class="prediction-grid">
        ${predictionHtml("胜平负", analysis.result, true)}
        ${predictionHtml("让球胜平负", analysis.handicap, true)}
        ${predictionHtml("总进球数", analysis.goals)}
        ${predictionHtml("比分", analysis.scores)}
        ${predictionHtml("半全场", analysis.halfFull)}
      </div>
      <div class="analysis-notes"><div><span>核心依据</span><ul>${analysis.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div><div><span>风险因素</span><ul>${analysis.risks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div></div>
    </article>`;
  }

  if (typeof module !== "undefined") module.exports = { analysisCardHtml };
  if (typeof document === "undefined") return;

  const listEl = document.querySelector("#analysisMatchList");
  const updatedEl = document.querySelector("#analysisUpdatedAt");

  async function loadAnalysis() {
    if (!listEl) return;
    try {
      const response = await fetch("/api/match-analysis", { cache: "no-store" });
      const data = await response.json();
      updatedEl.textContent = data.generatedAt ? `北京时间 ${formatTime(data.generatedAt)} 生成` : (data.reason || "尚未生成分析");
      const analysisByKey = new Map((data.analysis?.matches || []).map((item) => [item.key, item]));
      const facts = data.facts || [];
      if (!facts.length) {
        listEl.innerHTML = `<div class="panel-empty">${escapeHtml(data.reason || "暂无明日世界杯比赛")}</div>`;
        return;
      }
      listEl.innerHTML = facts.map((fact) => analysisCardHtml({ ...fact, analysis: analysisByKey.get(fact.key) })).join("");
    } catch (error) {
      listEl.innerHTML = `<div class="panel-empty">${escapeHtml(error.message || "读取分析失败")}</div>`;
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    document.querySelector(".workbench")?.addEventListener("worldcup:tabchange", (event) => {
      if (event.detail.active === "analysis") loadAnalysis();
    });
  });
})();
