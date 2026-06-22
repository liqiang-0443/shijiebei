const HALF_FULL = new Set(["胜胜", "胜平", "胜负", "平胜", "平平", "平负", "负胜", "负平", "负负"]);
const CONFIDENCE = new Set(["低", "中", "高"]);
const RESULTS = new Set(["主胜", "平", "客胜"]);
const HANDICAPS = new Set(["让胜", "让平", "让负"]);

function nonEmptyStrings(value, name, min, max) {
  if (!Array.isArray(value) || value.length < min || value.length > max || value.some((item) => !String(item || "").trim())) {
    throw new Error(`${name} is invalid`);
  }
}

function normalizeGoals(goals) {
  const values = Array.isArray(goals) ? goals : [goals];
  const normalized = values.flatMap((value) => {
    const text = String(value || "").trim();
    if (!text) return [];
    if (/^7\s*(?:\+|球?以上)$/.test(text)) return ["7+"];
    if (/^[0-6]\s*球?$/.test(text)) return [`${text.match(/[0-6]/)[0]}球`];
    const decimalOver = text.match(/大\s*([0-6])(?:\.5)?\s*球?/);
    if (decimalOver) {
      const start = Math.min(Number(decimalOver[1]) + 1, 6);
      return [start, start + 1, start + 2].filter((item) => item <= 6).map((item) => `${item}球`);
    }
    const range = text.match(/([0-6])\s*(?:[-到至~～—\/、或]|或者)\s*([0-6])\s*球?/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (end >= start) {
        return Array.from({ length: Math.min(end - start + 1, 3) }, (_, index) => `${start + index}球`);
      }
    }
    const listed = [...text.matchAll(/(?:^|[^\d.])([0-6])\s*球?/g)].map((match) => `${match[1]}球`);
    if (listed.length) return listed;
    return [text];
  });
  return [...new Set(normalized)].slice(0, 3);
}

function normalizeTextList(value, max) {
  const values = Array.isArray(value) ? value : String(value || "").split(/[；;\n]/);
  return values
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, max);
}

function validateAnalysis(input) {
  if (!Array.isArray(input?.matches) || !input.matches.length) throw new Error("matches is required");
  for (const match of input.matches) {
    if (!String(match.key || "").trim()) throw new Error("key is required");
    if (!RESULTS.has(match.result)) throw new Error("result is invalid");
    if (!HANDICAPS.has(match.handicap)) throw new Error("handicap is invalid");
    match.goals = normalizeGoals(match.goals || []);
    nonEmptyStrings(match.goals, "goals", 1, 3);
    if (match.goals.some((value) => !/^(?:[0-6]球|7\+)$/.test(value))) throw new Error("goals is invalid");
    nonEmptyStrings(match.scores, "scores", 3, 3);
    if (match.scores.some((value) => !/^(?:\d+:\d+|胜其他|平其他|负其他)$/.test(value))) throw new Error("scores is invalid");
    nonEmptyStrings(match.halfFull, "halfFull", 1, 2);
    if (match.halfFull.some((value) => !HALF_FULL.has(value))) throw new Error("halfFull is invalid");
    if (!CONFIDENCE.has(match.confidence)) throw new Error("confidence is invalid");
    match.evidence = normalizeTextList(match.evidence, 4);
    match.risks = normalizeTextList(match.risks, 3);
    nonEmptyStrings(match.evidence, "evidence", 1, 4);
    nonEmptyStrings(match.risks, "risks", 1, 3);
  }
  return input;
}

module.exports = { HALF_FULL, validateAnalysis };
