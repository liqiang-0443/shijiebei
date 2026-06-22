const test = require("node:test");
const assert = require("node:assert/strict");
const { analysisCardHtml } = require("../public/analysis");

test("renders all five prediction types", () => {
  const html = analysisCardHtml({
    home: "A",
    away: "B",
    analysis: {
      result: "主胜",
      handicap: "让负",
      goals: ["2球"],
      scores: ["1:1", "2:1", "1:0"],
      halfFull: ["平胜"],
      confidence: "中",
      evidence: ["赔率倾向"],
      risks: ["样本不足"],
    },
  });
  for (const label of ["胜平负", "让球胜平负", "总进球数", "比分", "半全场"]) {
    assert.match(html, new RegExp(label));
  }
});
