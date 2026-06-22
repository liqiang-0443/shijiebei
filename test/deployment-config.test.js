const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("deploy forwards an optional server-only analysis key", () => {
  const script = fs.readFileSync("scripts/deploy-vps.sh", "utf8");
  assert.match(script, /OPENAI_API_KEY/);
  assert.doesNotMatch(script, /sk-[A-Za-z0-9]/);
});

test("Docker image includes server helper modules", () => {
  const dockerfile = fs.readFileSync("Dockerfile", "utf8");
  assert.match(dockerfile, /COPY lib\s+\.\/lib/);
});
