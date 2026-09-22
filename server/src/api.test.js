const { test, before, after } = require("node:test");
const assert = require("node:assert");
const app = require("./app");
const prisma = require("./db");

let server;
let base;
let user;
let member;
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
  const r = await call("POST", "/accounts", { name: `API Test ${suffix} ${stamp}` }, user.id);
  accountIds.push(r.data.id);
  return r.data;
}

before(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
  user = await prisma.user.create({
    data: { name: "API Test User", email: `api-${stamp}@test.local`, role: "sales", hourlyRate: 1000 },
  });
  member = await prisma.user.create({
    data: { name: "API Member", email: `api-m-${stamp}@test.local`, role: "member", hourlyRate: 1000 },
  });
});

after(async () => {
  const ids = accountIds.filter(Boolean);
  if (ids.length) {
    await prisma.outboundEmail.deleteMany({
      where: { OR: [{ deal: { accountId: { in: ids } } }, { contact: { accountId: { in: ids } } }] },
    });
    await prisma.dealStageChange.deleteMany({ where: { deal: { accountId: { in: ids } } } });
    await prisma.project.deleteMany({ where: { accountId: { in: ids } } });
    await prisma.deal.deleteMany({ where: { accountId: { in: ids } } });
    await prisma.contact.deleteMany({ where: { accountId: { in: ids } } });
    await prisma.account.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.user.deleteMany({ where: { id: { in: [user.id, member.id] } } });
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

test("a blank company name is rejected with a readable message", async () => {
  const r = await call("POST", "/accounts", { name: "   " }, user.id);
  assert.equal(r.status, 400);
  assert.equal(r.data.error.message, "Company name is required.");
});

test("a duplicate account name is rejected", async () => {
  const a = await makeAccount("dup");
  const r = await call("POST", "/accounts", { name: a.name }, user.id);
  assert.equal(r.status, 409);
  assert.match(r.data.error.message, /already exists/);
});

test("contacts need a valid email and a real account", async () => {
  const a = await makeAccount("contact");

  const bad = await call("POST", `/accounts/${a.id}/contacts`, { name: "Rohit", email: "not-an-email" }, user.id);
  assert.equal(bad.status, 400);
  assert.match(bad.data.error.message, /valid email/);

  const ok = await call("POST", `/accounts/${a.id}/contacts`, { name: "Rohit", email: "rohit@test.local" }, user.id);
  assert.equal(ok.status, 201);
  assert.equal(ok.data.accountId, a.id);

  const withPerson = await call("POST", "/accounts", {
    name: `API Test with-person ${stamp}`,
    contactName: "Meera",
    contactEmail: `meera-acc-${stamp}@test.local`,
  }, user.id);
  assert.equal(withPerson.status, 201);
  accountIds.push(withPerson.data.id);
  assert.equal(withPerson.data.contacts[0].name, "Meera");

  const missing = await call("POST", "/accounts/999999/contacts", { name: "X", email: "x@test.local" }, user.id);
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

  const detail = await call("GET", `/deals/${id}`, undefined, user.id);
  assert.equal(detail.data.history.length, 3);
  assert.equal(detail.data.history[0].changedBy.name, "API Test User");
});

test("an archived account disappears from the list but is not deleted", async () => {
  const a = await makeAccount("archive");
  await call("POST", `/accounts/${a.id}/archive`, undefined, user.id);

  const list = await call("GET", "/accounts", undefined, user.id);
  assert.ok(!list.data.some((x) => x.id === a.id));

  const stillThere = await call("GET", `/accounts/${a.id}`, undefined, user.id);
  assert.equal(stillThere.status, 200);
  assert.equal(stillThere.data.isArchived, true);
});

test("delivery cannot open the sales pipeline, and sales cannot open delivery", async () => {
  const blocked = await call("GET", "/deals", undefined, member.id);
  assert.equal(blocked.status, 403);
  const projects = await call("GET", "/projects", undefined, user.id);
  assert.equal(projects.status, 403);
});

test("a lost deal can come back as new", async () => {
  const a = await makeAccount("comeback");
  const created = await call("POST", "/deals", {
    accountId: a.id, title: "Quiet deal", expectedValue: 100000, expectedDays: 10, expectedCloseDate: "2026-12-01",
  }, user.id);
  const id = created.data.id;
  await call("POST", `/deals/${id}/stage`, { stage: "lost", lostReason: "Went quiet" }, user.id);
  const back = await call("POST", `/deals/${id}/stage`, { stage: "new" }, user.id);
  assert.equal(back.status, 200);
  assert.equal(back.data.deal.stage, "new");
  assert.equal(back.data.deal.lostReason, null);
});

test("accounts, contacts and open deals can be edited and deleted", async () => {
  const a = await makeAccount("crud");
  const renamed = await call("PATCH", `/accounts/${a.id}`, { name: `Renamed ${stamp}`, industry: "Retail" }, user.id);
  assert.equal(renamed.status, 200);
  assert.equal(renamed.data.industry, "Retail");

  const contact = await call("POST", `/accounts/${a.id}/contacts`, {
    name: "Rohit", email: `rohit-crud-${stamp}@test.local`,
  }, user.id);
  const edited = await call("PATCH", `/accounts/${a.id}/contacts/${contact.data.id}`, { name: "Rohit Verma" }, user.id);
  assert.equal(edited.status, 200);
  assert.equal(edited.data.name, "Rohit Verma");

  const deal = await call("POST", "/deals", {
    accountId: a.id, title: "Temp", expectedValue: 50000, expectedDays: 5, expectedCloseDate: "2026-12-01",
  }, user.id);
  const dealEdit = await call("PATCH", `/deals/${deal.data.id}`, { title: "Temp renamed" }, user.id);
  assert.equal(dealEdit.status, 200);
  assert.equal(dealEdit.data.title, "Temp renamed");
  assert.equal(deal.data.proposalItems.length, 1);
  assert.equal(deal.data.proposalItems[0].estimatedDays, 5);

  const goneDeal = await call("DELETE", `/deals/${deal.data.id}`, undefined, user.id);
  assert.equal(goneDeal.status, 200);
  const goneContact = await call("DELETE", `/accounts/${a.id}/contacts/${contact.data.id}`, undefined, user.id);
  assert.equal(goneContact.status, 200);
  const goneAcc = await call("DELETE", `/accounts/${a.id}`, undefined, user.id);
  assert.equal(goneAcc.status, 200);
});

test("an account with a delivery project can still be deleted", async () => {
  const a = await makeAccount("with-project");
  const created = await call("POST", "/deals", {
    accountId: a.id, title: "Won app", expectedValue: 12000, expectedDays: 1, expectedCloseDate: "2026-12-01",
  }, user.id);
  const id = created.data.id;
  await call("POST", `/deals/${id}/proposal-items`, { title: "Build", estimatedDays: 1, dailyRate: 12000 }, user.id);
  await call("POST", `/deals/${id}/stage`, { stage: "qualified" }, user.id);
  await call("POST", `/deals/${id}/stage`, { stage: "proposal_sent" }, user.id);
  const won = await call("POST", `/deals/${id}/stage`, { stage: "won" }, user.id);
  assert.equal(won.status, 200);
  const gone = await call("DELETE", `/accounts/${a.id}`, undefined, user.id);
  assert.equal(gone.status, 200);
});

test("proposal email goes to the spoke-to contact and marks the deal sent", async () => {
  const a = await makeAccount("mail");
  const contact = await call("POST", `/accounts/${a.id}/contacts`, {
    name: "Meera", email: `meera-${stamp}@test.local`,
  }, user.id);
  const created = await call("POST", "/deals", {
    accountId: a.id, contactId: contact.data.id, title: "POS",
    expectedValue: 80000, expectedDays: 4, expectedCloseDate: "2026-12-01",
  }, user.id);
  const id = created.data.id;

  const tooSoon = await call("POST", `/deals/${id}/send-proposal`, {}, user.id);
  assert.equal(tooSoon.status, 400);

  await call("POST", `/deals/${id}/stage`, { stage: "qualified" }, user.id);
  const sent = await call("POST", `/deals/${id}/send-proposal`, {}, user.id);
  assert.equal(sent.status, 200);
  assert.equal(sent.data.deal.stage, "proposal_sent");
  assert.equal(sent.data.sent.to, contact.data.email);
  assert.equal(sent.data.sent.via, "outbox");
  assert.match(sent.data.sent.bodyText, /POS/);

  const follow = await call("POST", `/accounts/${a.id}/contacts/${contact.data.id}/spoke`, {
    note: "Walked through the proposal", email: true,
  }, user.id);
  assert.equal(follow.status, 200);
  assert.equal(follow.data.sent.to, contact.data.email);
});

