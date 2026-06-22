function latestSnapshotForDate(history, displayDate) {
  return [...(history || [])]
    .reverse()
    .find((snapshot) => snapshot.displayDate === displayDate && Array.isArray(snapshot.matches) && snapshot.matches.length) || null;
}

module.exports = { latestSnapshotForDate };
