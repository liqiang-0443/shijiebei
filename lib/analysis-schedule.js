function shouldRunAnalysis(history, slot) {
  return !history.some((item) => item.slot === slot);
}

module.exports = { shouldRunAnalysis };
