const { test, before, after } = require("node:test");
const assert = require("node:assert");
const prisma = require("../db");
const { changeStage } = require("./deals");

let account;
let user;

before(async () => {
  const stamp = Date.now();
  account = await prisma.account.create({ data: { name: `Test Account ${stamp}` } });
  user = await prisma.user.create({
    data: { name: "Test User", email: `test-${stamp}@test.local`, role: "sales", hourlyRate: 1000 },
  });
});

after(async () => {
  // Order important: pehle bacche, phir parent
  await prisma.dealStageChange.deleteMany({ where: { deal: { accountId: account.id } } });
  await prisma.project.deleteMany({ where: { accountId: account.id } });
  await prisma.deal.deleteMany({ where: { accountId: account.id } });
  await prisma.account.delete({ where: { id: account.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
});

function makeDeal(stage = "proposal_sent") {
  return prisma.deal.create({
    data: {
      accountId: account.id,
      title: "Test deal",
      stage,
      expectedValue: 400000,
      expectedDays: 30,
      expectedCloseDate: new Date("2026-12-01"),
      ownerId: user.id,
    },
  });
}

test("Won creates a project with the sold budget, and the deal stays", async () => {
  const deal = await makeDeal();
  const { project } = await changeStage(deal.id, "won", { userId: user.id });

  assert.equal(project.dealId, deal.id);
  assert.equal(project.budgetDays, 30);
  assert.equal(project.budgetAmount, 400000);

  const saved = await prisma.deal.findUnique({ where: { id: deal.id } });
  assert.equal(saved.stage, "won");

  const history = await prisma.dealStageChange.findMany({ where: { dealId: deal.id } });
  assert.equal(history.length, 1);
  assert.equal(history[0].toStage, "won");
  assert.equal(history[0].changedById, user.id);
});

test("changing the deal later does not change the project's sold budget", async () => {
  const deal = await makeDeal();
  const { project } = await changeStage(deal.id, "won");

  await prisma.deal.update({ where: { id: deal.id }, data: { expectedDays: 55 } });

  const savedProject = await prisma.project.findUnique({ where: { id: project.id } });
  assert.equal(savedProject.budgetDays, 30); // original 40-jaisa scope safe hai
});

test("a deal cannot be converted twice", async () => {
  const deal = await makeDeal();
  await changeStage(deal.id, "won");

  // Dobara Won karne ki koshish
  await assert.rejects(
    () => changeStage(deal.id, "won"),
    (err) => err.name === "AppError" && /already in Won/.test(err.message)
  );

  // Won deal ko Lost karne ki koshish bhi blocked
  await assert.rejects(
    () => changeStage(deal.id, "lost", { lostReason: "changed mind" }),
    (err) => err.name === "AppError" && /already Won/.test(err.message)
  );

  // Sabse zaroori: project sirf ek hi bana
  const count = await prisma.project.count({ where: { dealId: deal.id } });
  assert.equal(count, 1);
});

test("Lost without a reason is rejected and nothing changes", async () => {
  const deal = await makeDeal();

  await assert.rejects(
    () => changeStage(deal.id, "lost"),
    (err) => /why the deal was lost/.test(err.message)
  );

  const saved = await prisma.deal.findUnique({ where: { id: deal.id } });
  assert.equal(saved.stage, "proposal_sent");
  const history = await prisma.dealStageChange.count({ where: { dealId: deal.id } });
  assert.equal(history, 0);
});

test("a stale screen gets a conflict instead of overwriting", async () => {
  const deal = await makeDeal();

  await assert.rejects(
    () => changeStage(deal.id, "won", { version: 99 }),
    (err) => err.code === "CONFLICT" && err.status === 409
  );

  const count = await prisma.project.count({ where: { dealId: deal.id } });
  assert.equal(count, 0);
});