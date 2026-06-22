function shouldRunAnalysis(history, slot, options = {}) {
  const record = history.find((item) => item.slot === slot);
  if (!record) return true;
  return Boolean(options.retryNoMatches && record.status === "unavailable" && record.reason === "no tomorrow World Cup matches");
}

module.exports = { shouldRunAnalysis };
