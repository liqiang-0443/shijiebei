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

test("renders FIFA ranking and tournament record as a comparison table", () => {
  const html = analysisCardHtml({
    matchNum: "周一041",
    home: "阿根廷",
    away: "奥地利",
    statistics: {
      fifaRanking: {
        home: "FIFA第1，1877.27分，较上期+2",
        away: "FIFA第24，1597.40分，较上期0",
      },
      tournamentTable: [
        { side: "home", team: "阿根廷", fifaRanking: "FIFA第1，1877.27分，较上期+2", groupStanding: "J 第1，积3分", played: 1, win: 1, draw: 0, loss: 0, goalsFor: 3, goalsAgainst: 0, goalDifference: 3, points: 3, form: "W" },
        { side: "away", team: "奥地利", fifaRanking: "FIFA第24，1597.40分，较上期0", groupStanding: "J 第2，积3分", played: 1, win: 1, draw: 0, loss: 0, goalsFor: 3, goalsAgainst: 1, goalDifference: 2, points: 3, form: "W" },
      ],
      recentForm: { home: [], away: [] },
      headToHead: null,
    },
    dataGaps: [],
    analysis: {
      result: "主胜",
      handicap: "让胜",
      goals: ["2球"],
      scores: ["1:0", "2:0", "2:1"],
      halfFull: ["胜胜"],
      confidence: "低",
      evidence: ["排名优势"],
      risks: ["样本少"],
    },
  });
  assert.match(html, /FIFA排名/);
  assert.match(html, /本届战绩/);
  assert.match(html, /<table class="tournament-table">/);
  assert.match(html, /阿根廷/);
  assert.match(html, /FIFA第1/);
  assert.match(html, /1-0/);
});
