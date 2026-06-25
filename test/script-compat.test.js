const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("selection and submission scripts can share one page", () => {
  const betting = fs.readFileSync("public/betting.js", "utf8");
  const app = fs.readFileSync("public/app.js", "utf8");
  const admin = fs.readFileSync("public/admin.js", "utf8");
  assert.doesNotThrow(() => new vm.Script(`${betting}\n${app}\n${admin}`));
});

test("payer summary buttons are not clamped by mobile button height", () => {
  const css = fs.readFileSync("public/styles.css", "utf8");
  const mobileButtonHeight = css.search(/button\s*\{\s*height:\s*40px;/);
  const summaryOverride = css.slice(mobileButtonHeight).search(/\.payer-summary-item\s*\{\s*height:\s*auto;/);

  assert.notEqual(mobileButtonHeight, -1);
  assert.notEqual(summaryOverride, -1);
});
