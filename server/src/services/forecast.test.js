const test = require("node:test");
const assert = require("node:assert");
const { weightedValue, isQuiet, proposalTotals, buildForecast, quarterRange } = require("./forecast");

test("proposal line items add up days and rupees", () => {
  const t = proposalTotals([
    { estimatedDays: 10, dailyRate: 8000 },
    { estimatedDays: 5, dailyRate: 10000 },
  ]);
  assert.equal(t.expectedDays, 15);
  assert.equal(t.expectedValue, 80000 + 50000);
});

test("weighted value uses stage probability", () => {
  assert.equal(weightedValue({ expectedValue: 100000, stage: "new" }), 10000);
  assert.equal(weightedValue({ expectedValue: 100000, stage: "proposal_sent" }), 60000);
  assert.equal(weightedValue({ expectedValue: 100000, stage: "won" }), 100000);
  assert.equal(weightedValue({ expectedValue: 100000, stage: "lost" }), 0);
});

test("a deal with no activity for 120 days is quiet, won/lost are not", () => {
  const now = new Date("2026-09-22T00:00:00Z");
  const old = { stage: "qualified", lastActivityAt: "2026-04-01T00:00:00Z" };
  const recent = { stage: "qualified", lastActivityAt: "2026-09-01T00:00:00Z" };
  assert.equal(isQuiet(old, now), true);
  assert.equal(isQuiet(recent, now), false);
  assert.equal(isQuiet({ ...old, stage: "lost" }, now), false);
});

test("this quarter forecast ignores lost deals and dates outside the quarter", () => {
  const now = new Date("2026-09-22T00:00:00Z");
  const { start, end, label } = quarterRange(now);
  assert.equal(label, "Q3 2026");
  assert.equal(start.toISOString().slice(0, 10), "2026-07-01");
  assert.equal(end.toISOString().slice(0, 10), "2026-10-01");

  const report = buildForecast([
    { expectedValue: 200000, stage: "proposal_sent", expectedCloseDate: "2026-09-28", lastActivityAt: "2026-09-01" },
    { expectedValue: 500000, stage: "qualified", expectedCloseDate: "2026-11-10", lastActivityAt: "2026-09-01" },
    { expectedValue: 100000, stage: "lost", expectedCloseDate: "2026-09-15", lastActivityAt: "2026-08-01" },
  ], now);

  assert.equal(report.deals.length, 1);
  assert.equal(report.likely, 120000);
  assert.equal(report.unweighted, 200000);
});
