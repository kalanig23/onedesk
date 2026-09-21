const test = require("node:test");
const assert = require("node:assert");
const { validateHours, parseDay, checkDailyTotal } = require("./timeRules");

test("hours must be more than 0 and at most 24", () => {
  assert.equal(validateHours(3.5), 3.5);
  assert.equal(validateHours("4"), 4);
  for (const bad of [0, -2, 30, "abc", "", null, NaN]) {
    assert.throws(() => validateHours(bad), /Hours must be/);
  }
});

test("dates must be real and not in the future", () => {
  assert.equal(parseDay("2026-09-01").toISOString(), "2026-09-01T00:00:00.000Z");
  assert.throws(() => parseDay("21-09-2026"), /look like/);
  assert.throws(() => parseDay("2026-02-31"), /does not exist/);
  assert.throws(() => parseDay("2099-01-01"), /future/);
});

test("a day cannot go over 24 hours in total", () => {
  checkDailyTotal(20, 4); // exactly 24 is fine
  assert.throws(() => checkDailyTotal(20, 5), /already logged 20h/);
});