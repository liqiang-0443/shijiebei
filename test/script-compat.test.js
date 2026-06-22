const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("selection and submission scripts can share one page", () => {
  const app = fs.readFileSync("public/app.js", "utf8");
  const admin = fs.readFileSync("public/admin.js", "utf8");
  assert.doesNotThrow(() => new vm.Script(`${app}\n${admin}`));
});
