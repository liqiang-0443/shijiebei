const test = require("node:test");
const assert = require("node:assert/strict");
const { createSingleFlight } = require("../lib/single-flight");

test("shares one in-flight analysis refresh across concurrent callers", async () => {
  const run = createSingleFlight();
  let calls = 0;
  let release;
  const work = () => {
    calls += 1;
    return new Promise((resolve) => { release = resolve; });
  };

  const first = run(work);
  const second = run(work);
  assert.strictEqual(first, second);
  assert.equal(calls, 1);
  release({ ok: true });
  assert.deepEqual(await first, { ok: true });
});
