const test = require("node:test");
const assert = require("node:assert/strict");
const { validateAnalysis } = require("../lib/analysis-schema");

test("accepts every requested prediction category", () => {
  const result = validateAnalysis({
    matches: [{
      key: "m1",
      result: "主胜",
      handicap: "让负",
      goals: ["2球", "3球"],
      scores: ["1:1", "2:1", "1:0"],
      halfFull: ["平胜", "胜胜"],
      confidence: "中",
      evidence: ["排名更高"],
      risks: ["样本较少"],
    }],
  });
  assert.equal(result.matches[0].halfFull[0], "平胜");
});

test("rejects a half full time prediction outside the nine outcomes", () => {
  assert.throws(() => validateAnalysis({
    matches: [{
      key: "m1",
      result: "主胜",
      handicap: "让负",
      goals: ["2球"],
      scores: ["1:1", "2:1", "1:0"],
      halfFull: ["主胜"],
      confidence: "中",
      evidence: ["排名更高"],
      risks: ["样本较少"],
    }],
  }), /halfFull/);
});

test("normalizes a compact total-goals range from model output", () => {
  const result = validateAnalysis({
    matches: [{
      key: "m1",
      result: "主胜",
      handicap: "让胜",
      goals: ["2-3球"],
      scores: ["1:0", "2:0", "2:1"],
      halfFull: ["胜胜"],
      confidence: "低",
      evidence: ["赔率低位集中在主胜小比分"],
      risks: ["仅基于赔率快照"],
    }],
  });
  assert.deepEqual(result.matches[0].goals, ["2球", "3球"]);
});
