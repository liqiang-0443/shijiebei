const TIME_ZONE = "Asia/Shanghai";

function chinaParts(date = new Date()) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).map((part) => [part.type, part.value]));
}

function formatChinaDate(date = new Date()) {
  const parts = chinaParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getChinaDateOffset(offsetDays, now = new Date()) {
  const parts = chinaParts(now);
  const utc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  return new Date(utc + offsetDays * 86400000).toISOString().slice(0, 10);
}

function getAnalysisSlot(now = new Date()) {
  const parts = chinaParts(now);
  return `${parts.year}-${parts.month}-${parts.day}T06:00`;
}

function isAnalysisDue(now = new Date()) {
  const parts = chinaParts(now);
  return Number(parts.hour) >= 6;
}

module.exports = { TIME_ZONE, chinaParts, formatChinaDate, getChinaDateOffset, getAnalysisSlot, isAnalysisDue };
