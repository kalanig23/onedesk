const test = require("node:test");
const assert = require("node:assert");
const { validateStageChange } = require("./dealRules");
const { AppError } = require("../errors");

function rejects(fn, pattern) {
  assert.throws(fn, (err) => err instanceof AppError && pattern.test(err.message));
}

test("a deal moves forward one stage at a time", () => {
  validateStageChange("new", "qualified");
  validateStageChange("qualified", "proposal_sent");
  validateStageChange("proposal_sent", "won");
});

test("skipping a stage is blocked", () => {
  rejects(() => validateStageChange("new", "won"), /can only move to/);
});

test("Lost needs a reason, and blank spaces do not count", () => {
  rejects(() => validateStageChange("qualified", "lost"), /why the deal was lost/);
  rejects(() => validateStageChange("qualified", "lost", "   "), /why the deal was lost/);
  validateStageChange("qualified", "lost", "Budget cut");
});

test("a deal can be lost from any open stage", () => {
  for (const stage of ["new", "qualified", "proposal_sent"]) {
    validateStageChange(stage, "lost", "Went with a competitor");
  }
});

test("Won deals cannot be moved again, but Lost can come back as New", () => {
  rejects(() => validateStageChange("won", "lost", "changed mind"), /already Won/);
  validateStageChange("lost", "new");
});

test("unknown stages and same-stage moves are rejected", () => {
  rejects(() => validateStageChange("new", "banana"), /does not exist/);
  rejects(() => validateStageChange("new", "new"), /already in New/);
});