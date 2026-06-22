const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("deploy forwards an optional server-only DeepSeek key and triggers an analysis run", () => {
  const script = fs.readFileSync("scripts/deploy-vps.sh", "utf8");
  assert.match(script, /DEEPSEEK_API_KEY/);
  assert.match(script, /api\/analysis\/deploy/);
  assert.doesNotMatch(script, /sk-[A-Za-z0-9]/);
});

test("Docker image includes server helper modules", () => {
  const dockerfile = fs.readFileSync("Dockerfile", "utf8");
  assert.match(dockerfile, /COPY lib\s+\.\/lib/);
});
