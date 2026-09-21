const test = require("node:test");
const assert = require("node:assert");
const { calculateBudget } = require("./budget");

const project = { budgetDays: 10, budgetAmount: 100000 };

test("under budget: days, amount and remaining are correct", () => {
  const entries = Array(4).fill({ hours: 8, billable: true, rateAtEntry: 1000 });
  const r = calculateBudget(project, entries);
  assert.equal(r.burnedDays, 4);
  assert.equal(r.burnedAmount, 32000);
  assert.equal(r.remainingDays, 6);
  assert.equal(r.remainingAmount, 68000);
  assert.equal(r.percentDays, 40);
  assert.equal(r.status, "ok");
});

test("non-billable hours count as burned days but not as amount", () => {
  const entries = [
    { hours: 8, billable: true, rateAtEntry: 2000 },
    { hours: 8, billable: false, rateAtEntry: 2000 },
  ];
  const r = calculateBudget(project, entries);
  assert.equal(r.burnedDays, 2);
  assert.equal(r.burnedAmount, 16000);
  assert.equal(r.billableHours, 8);
  assert.equal(r.nonBillableHours, 8);
});

test("over budget is flagged, even if the amount is still under", () => {
  const entries = Array(11).fill({ hours: 8, billable: true, rateAtEntry: 1000 });
  const r = calculateBudget(project, entries);
  assert.equal(r.percentDays, 110);
  assert.equal(r.percentAmount, 88); // amount abhi under hai
  assert.equal(r.remainingDays, -1);
  assert.equal(r.status, "over");
});

test("exactly 90% is a warning", () => {
  const entries = Array(9).fill({ hours: 8, billable: true, rateAtEntry: 1000 });
  const r = calculateBudget(project, entries);
  assert.equal(r.percentDays, 90);
  assert.equal(r.status, "warning");
});

test("each entry uses its own frozen rate", () => {
  const entries = [
    { hours: 8, billable: true, rateAtEntry: 2000 },
    { hours: 8, billable: true, rateAtEntry: 2200 }, // rate badha
  ];
  const r = calculateBudget(project, entries);
  assert.equal(r.burnedAmount, 33600);
});

test("no time entries gives zeros and ok status", () => {
  const r = calculateBudget(project, []);
  assert.equal(r.burnedDays, 0);
  assert.equal(r.burnedAmount, 0);
  assert.equal(r.status, "ok");
});