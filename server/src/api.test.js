const { test, before, after } = require("node:test");
const assert = require("node:assert");
const app = require("./app");
const prisma = require("./db");

let server;
let base;
let user;
const accountIds = [];
const stamp = Date.now();

async function call(method, path, body, userId) {
  const headers = { "Content-Type": "application/json" };
  if (userId) headers["x-user-id"] = String(userId);
  const res = await fetch(base + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function makeAccount(suffix) {
  const r = await call("POST", "/accounts", { name: `API Test ${suffix} ${stamp}` });
  accountIds.push(r.data.id);
  return r.data;
}

before(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
  user = await prisma.user.create({
    data: { name: "API Test User", email: `api-${stamp}@test.local`, role: "sales", hourlyRate: 1000 },
  });
});

after(async () => {
  // Pehle bacche, phir parent
  await prisma.dealStageChange.deleteMany({ where: { deal: { accountId: { in: accountIds } } } });
  await prisma.project.deleteMany({ where: { accountId: { in: accountIds } } });
  await prisma.deal.deleteMany({ where: { accountId: { in: accountIds } } });
  await prisma.contact.deleteMany({ where: { accountId: { in: accountIds } } });
  await prisma.account.deleteMany({ where: { id: { in: accountIds } } });
  await prisma.user.delete({ where: { id: user.id } });
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

test("a blank company name is rejected with a readable message", async () => {
  const r = await call("POST", "/accounts", { name: "   " });
  assert.equal(r.status, 400);
  assert.equal(r.data.error.message, "Company name is required.");
});

test("a duplicate account name is rejected", async () => {
  const a = await makeAccount("dup");
  const r = await call("POST", "/accounts", { name: a.name });
  assert.equal(r.status, 409);
  assert.match(r.data.error.message, /already exists/);
});

test("contacts need a valid email and a real account", async () => {
  const a = await makeAccount("contact");

  const bad = await call("POST", `/accounts/${a.id}/contacts`, { name: "Rohit", email: "not-an-email" });
  assert.equal(bad.status, 400);
  assert.match(bad.data.error.message, /valid email/);

  const ok = await call("POST", `/accounts/${a.id}/contacts`, { name: "Rohit", email: "rohit@test.local" });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.accountId, a.id);

  const missing = await call("POST", "/accounts/999999/contacts", { name: "X", email: "x@test.local" });
  assert.equal(missing.status, 404);
});

test("a deal with a negative value or missing fields is rejected", async () => {
  const a = await makeAccount("deal");
  const base = { accountId: a.id, title: "Site", expectedValue: 100000, expectedDays: 10, expectedCloseDate: "2026-12-01" };

  const neg = await call("POST", "/deals", { ...base, expectedValue: -5 }, user.id);
  assert.equal(neg.status, 400);
  assert.match(neg.data.error.message, /greater than 0/);

  const noTitle = await call("POST", "/deals", { ...base, title: "" }, user.id);
  assert.equal(noTitle.status, 400);
  assert.equal(noTitle.data.error.message, "Deal title is required.");
});

test("Lost needs a reason, and Won creates a project only once", async () => {
  const a = await makeAccount("stage");
  const created = await call("POST", "/deals", {
    accountId: a.id, title: "App", expectedValue: 300000, expectedDays: 25, expectedCloseDate: "2026-12-01",
  }, user.id);
  const id = created.data.id;

  await call("POST", `/deals/${id}/stage`, { stage: "qualified" }, user.id);
  await call("POST", `/deals/${id}/stage`, { stage: "proposal_sent" }, user.id);

  const noReason = await call("POST", `/deals/${id}/stage`, { stage: "lost" }, user.id);
  assert.equal(noReason.status, 400);
  assert.match(noReason.data.error.message, /why the deal was lost/);

  const won = await call("POST", `/deals/${id}/stage`, { stage: "won" }, user.id);
  assert.equal(won.status, 200);
  assert.equal(won.data.project.budgetDays, 25);
  assert.equal(won.data.project.budgetAmount, 300000);

  const again = await call("POST", `/deals/${id}/stage`, { stage: "won" }, user.id);
  assert.equal(again.status, 400);

  const detail = await call("GET", `/deals/${id}`);
  assert.equal(detail.data.history.length, 3); // qualified, proposal_sent, won
  assert.equal(detail.data.history[0].changedBy.name, "API Test User");
});

test("an archived account disappears from the list but is not deleted", async () => {
  const a = await makeAccount("archive");
  await call("POST", `/accounts/${a.id}/archive`);

  const list = await call("GET", "/accounts");
  assert.ok(!list.data.some((x) => x.id === a.id));

  const stillThere = await call("GET", `/accounts/${a.id}`);
  assert.equal(stillThere.status, 200);
  assert.equal(stillThere.data.isArchived, true);
});