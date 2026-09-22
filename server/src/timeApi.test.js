const { test, before, after } = require("node:test");
const assert = require("node:assert");
const app = require("./app");
const prisma = require("./db");

const stamp = Date.now();
let server, base, anjali, outsider, ravi, account, deal, project, task;

async function call(method, path, body, userId) {
  const headers = { "Content-Type": "application/json" };
  if (userId) headers["x-user-id"] = String(userId);
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json() };
}

before(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
  anjali = await prisma.user.create({
    data: { name: "T Anjali", email: `ta-${stamp}@test.local`, role: "member", hourlyRate: 2000 },
  });
  outsider = await prisma.user.create({
    data: { name: "T Outsider", email: `to-${stamp}@test.local`, role: "member", hourlyRate: 1000 },
  });
  ravi = await prisma.user.create({
    data: { name: "T Ravi", email: `tr-${stamp}@test.local`, role: "manager", hourlyRate: 3000 },
  });
  account = await prisma.account.create({ data: { name: `Time Test ${stamp}` } });
  deal = await prisma.deal.create({
    data: {
      accountId: account.id, title: "Time deal", stage: "won", expectedValue: 100000,
      expectedDays: 10, expectedCloseDate: new Date("2026-12-01"),
    },
  });
  project = await prisma.project.create({
    data: {
      dealId: deal.id, accountId: account.id, name: "Time project", budgetDays: 10, budgetAmount: 100000,
      members: { create: [{ userId: anjali.id }, { userId: ravi.id }] },
    },
  });
  task = await prisma.task.create({ data: { projectId: project.id, title: "Build", assigneeId: anjali.id } });
});

after(async () => {
  await prisma.timeEntry.deleteMany({ where: { task: { projectId: project.id } } });
  await prisma.task.deleteMany({ where: { projectId: project.id } });
  await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
  await prisma.project.delete({ where: { id: project.id } });
  await prisma.deal.delete({ where: { id: deal.id } });
  await prisma.account.delete({ where: { id: account.id } });
  await prisma.user.deleteMany({ where: { id: { in: [anjali.id, outsider.id, ravi.id] } } });
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

test("each entry freezes the rate of that day, and budget uses it", async () => {
  const a = await call("POST", "/time-entries", { taskId: task.id, date: "2026-09-01", hours: 4 }, anjali.id);
  assert.equal(a.status, 201);
  assert.equal(a.data.rateAtEntry, 2000);

  await prisma.user.update({ where: { id: anjali.id }, data: { hourlyRate: 2200 } });

  const b = await call("POST", "/time-entries", { taskId: task.id, date: "2026-09-02", hours: 4 }, anjali.id);
  assert.equal(b.data.rateAtEntry, 2200);

  const old = await prisma.timeEntry.findUnique({ where: { id: a.data.id } });
  assert.equal(old.rateAtEntry, 2000);

  const budget = await call("GET", `/projects/${project.id}/budget`, undefined, anjali.id);
  assert.equal(budget.data.totalHours, 8);
  assert.equal(budget.data.burnedAmount, 4 * 2000 + 4 * 2200);
  assert.equal(budget.data.burnedDays, 1);
});

test("someone who is not on the project cannot log time", async () => {
  const r = await call("POST", "/time-entries", { taskId: task.id, date: "2026-09-03", hours: 2 }, outsider.id);
  assert.equal(r.status, 403);
  assert.match(r.data.error.message, /not on this project/);
});

test("hours can only be logged by the assignee", async () => {
  const other = await call("POST", "/time-entries", { taskId: task.id, date: "2026-09-07", hours: 2 }, ravi.id);
  assert.equal(other.status, 403);
  assert.match(other.data.error.message, /assigned to you/);
});

test("absurd hours are rejected with a readable message", async () => {
  for (const hours of [30, 0, -1, "abc"]) {
    const r = await call("POST", "/time-entries", { taskId: task.id, date: "2026-09-04", hours }, anjali.id);
    assert.equal(r.status, 400);
    assert.match(r.data.error.message, /Hours must be/);
  }
});

test("a day cannot go over 24 hours across entries", async () => {
  const first = await call("POST", "/time-entries", { taskId: task.id, date: "2026-08-03", hours: 20 }, anjali.id);
  assert.equal(first.status, 201);
  const over = await call("POST", "/time-entries", { taskId: task.id, date: "2026-08-03", hours: 5 }, anjali.id);
  assert.equal(over.status, 400);
  assert.match(over.data.error.message, /already logged 20h/);
  const exact = await call("POST", "/time-entries", { taskId: task.id, date: "2026-08-03", hours: 4 }, anjali.id);
  assert.equal(exact.status, 201);
});

test("future dates and a missing login are rejected", async () => {
  const future = await call("POST", "/time-entries", { taskId: task.id, date: "2099-01-01", hours: 2 }, anjali.id);
  assert.equal(future.status, 400);
  const noUser = await call("POST", "/time-entries", { taskId: task.id, date: "2026-09-05", hours: 2 });
  assert.equal(noUser.status, 401);
});

test("a closed project does not accept time, and works again once reopened", async () => {
  await call("POST", `/projects/${project.id}/status`, { status: "closed" }, ravi.id);
  const blocked = await call("POST", "/time-entries", { taskId: task.id, date: "2026-09-06", hours: 2 }, anjali.id);
  assert.equal(blocked.status, 409);
  assert.match(blocked.data.error.message, /closed/);

  await call("POST", `/projects/${project.id}/status`, { status: "active" }, ravi.id);
  const ok = await call("POST", "/time-entries", { taskId: task.id, date: "2026-09-06", hours: 2 }, anjali.id);
  assert.equal(ok.status, 201);
});

test("only a manager can assign tasks, and only to someone on the project", async () => {
  const memberAssign = await call("PATCH", `/tasks/${task.id}`, { assigneeId: anjali.id }, anjali.id);
  assert.equal(memberAssign.status, 403);

  const bad = await call("PATCH", `/tasks/${task.id}`, { assigneeId: outsider.id }, ravi.id);
  assert.equal(bad.status, 400);
  assert.match(bad.data.error.message, /not on this project/);

  const good = await call("PATCH", `/tasks/${task.id}`, { assigneeId: anjali.id, status: "in_progress" }, ravi.id);
  assert.equal(good.status, 200);
  assert.equal(good.data.assigneeId, anjali.id);
});

test("a member cannot add tasks or people; the manager can", async () => {
  const addTask = await call("POST", `/projects/${project.id}/tasks`, { title: "Nope" }, anjali.id);
  assert.equal(addTask.status, 403);
  const addPerson = await call("POST", `/projects/${project.id}/members`, { userId: outsider.id }, anjali.id);
  assert.equal(addPerson.status, 403);

  const created = await call("POST", `/projects/${project.id}/tasks`, { title: "Design", assigneeId: anjali.id }, ravi.id);
  assert.equal(created.status, 201);

  const asMember = await call("GET", `/projects/${project.id}`, undefined, anjali.id);
  assert.equal(asMember.status, 200);
  assert.equal(asMember.data.canManage, false);
  assert.ok(asMember.data.progress.total >= 2);

  const asManager = await call("GET", `/projects/${project.id}`, undefined, ravi.id);
  assert.equal(asManager.data.canManage, true);
});
