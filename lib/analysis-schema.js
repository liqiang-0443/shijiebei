const HALF_FULL = new Set(["胜胜", "胜平", "胜负", "平胜", "平平", "平负", "负胜", "负平", "负负"]);
const CONFIDENCE = new Set(["低", "中", "高"]);
const RESULTS = new Set(["主胜", "平", "客胜"]);
const HANDICAPS = new Set(["让胜", "让平", "让负"]);

function nonEmptyStrings(value, name, min, max) {
  if (!Array.isArray(value) || value.length < min || value.length > max || value.some((item) => !String(item || "").trim())) {
    throw new Error(`${name} is invalid`);
  }
}

function validateAnalysis(input) {
  if (!Array.isArray(input?.matches) || !input.matches.length) throw new Error("matches is required");
  for (const match of input.matches) {
    if (!String(match.key || "").trim()) throw new Error("key is required");
    if (!RESULTS.has(match.result)) throw new Error("result is invalid");
    if (!HANDICAPS.has(match.handicap)) throw new Error("handicap is invalid");
    nonEmptyStrings(match.goals, "goals", 1, 2);
    if (match.goals.some((value) => !/^(?:[0-6]球|7\+)$/.test(value))) throw new Error("goals is invalid");
    nonEmptyStrings(match.scores, "scores", 3, 3);
    if (match.scores.some((value) => !/^(?:\d+:\d+|胜其他|平其他|负其他)$/.test(value))) throw new Error("scores is invalid");
    nonEmptyStrings(match.halfFull, "halfFull", 1, 2);
    if (match.halfFull.some((value) => !HALF_FULL.has(value))) throw new Error("halfFull is invalid");
    if (!CONFIDENCE.has(match.confidence)) throw new Error("confidence is invalid");
    nonEmptyStrings(match.evidence, "evidence", 1, 4);
    nonEmptyStrings(match.risks, "risks", 1, 3);
  }
  return input;
}

module.exports = { HALF_FULL, validateAnalysis };
