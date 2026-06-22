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

test("normalizes common model total-goals wording", () => {
  const result = validateAnalysis({
    matches: [{
      key: "m1",
      result: "主胜",
      handicap: "让胜",
      goals: ["3或4球", "7球以上"],
      scores: ["3:0", "4:0", "2:0"],
      halfFull: ["胜胜"],
      confidence: "低",
      evidence: ["进球赔率集中"],
      risks: ["仅基于赔率快照"],
    }],
  });
  assert.deepEqual(result.matches[0].goals, ["3球", "4球", "7+"]);
});

test("normalizes a string total-goals prediction from model output", () => {
  const result = validateAnalysis({
    matches: [{
      key: "m1",
      result: "主胜",
      handicap: "让胜",
      goals: "2或3球",
      scores: ["2:0", "2:1", "3:0"],
      halfFull: ["胜胜"],
      confidence: "低",
      evidence: ["进球赔率集中"],
      risks: ["仅基于赔率快照"],
    }],
  });
  assert.deepEqual(result.matches[0].goals, ["2球", "3球"]);
});

test("normalizes broader model total-goals ranges to selectable outcomes", () => {
  const result = validateAnalysis({
    matches: [{
      key: "m1",
      result: "主胜",
      handicap: "让胜",
      goals: ["2-4球", "3/4/5球", "大2.5球"],
      scores: ["2:0", "2:1", "3:1"],
      halfFull: ["胜胜"],
      confidence: "低",
      evidence: ["进球赔率集中"],
      risks: ["仅基于赔率快照"],
    }],
  });
  assert.deepEqual(result.matches[0].goals, ["2球", "3球", "4球"]);
});

test("normalizes evidence and risks from flexible model output", () => {
  const result = validateAnalysis({
    matches: [{
      key: "m1",
      result: "主胜",
      handicap: "让胜",
      goals: ["2球"],
      scores: ["1:0", "2:0", "2:1"],
      halfFull: ["胜胜"],
      confidence: "低",
      evidence: "FIFA排名优势；本届首战取胜；赔率支持主胜；比分低赔集中；额外说明",
      risks: ["样本少", "历史交锋缺失", "赔率波动", "额外风险"],
    }],
  });
  assert.deepEqual(result.matches[0].evidence, ["FIFA排名优势", "本届首战取胜", "赔率支持主胜", "比分低赔集中"]);
  assert.deepEqual(result.matches[0].risks, ["样本少", "历史交锋缺失", "赔率波动"]);
});
