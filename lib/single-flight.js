function createSingleFlight() {
  let active = null;
  return function run(operation) {
    if (active) return active;
    try {
      active = Promise.resolve(operation()).finally(() => { active = null; });
    } catch (error) {
      active = Promise.reject(error).finally(() => { active = null; });
    }
    return active;
  };
}

module.exports = { createSingleFlight };
