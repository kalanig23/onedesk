const { test, before, after } = require("node:test");
const assert = require("node:assert");
const bcrypt = require("bcryptjs");
const app = require("./app");
const prisma = require("./db");

const stamp = Date.now();
let server, base, admin, member;

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

before(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
  const passwordHash = bcrypt.hashSync("password123", 4);
  admin = await prisma.user.create({
    data: { name: "Test Admin", email: `admin-${stamp}@test.local`, passwordHash, role: "admin", hourlyRate: 0 },
  });
  member = await prisma.user.create({
    data: { name: "Test Member", email: `mem-${stamp}@test.local`, passwordHash, role: "member", hourlyRate: 1000 },
  });
});

after(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [admin.id, member.id] } } });
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

test("only admin can open the people panel", async () => {
  const denied = await call("GET", "/admin/people", undefined, member.id);
  assert.equal(denied.status, 403);

  const ok = await call("GET", "/admin/people", undefined, admin.id);
  assert.equal(ok.status, 200);
  assert.ok(Array.isArray(ok.data.people));
  assert.ok(ok.data.people.some((p) => p.id === admin.id));
  assert.equal(ok.data.people.find((p) => p.id === admin.id).passwordHash, undefined);
});

test("admin can update a person's hourly rate", async () => {
  const bad = await call("PATCH", `/admin/people/${member.id}`, { hourlyRate: 1800 }, member.id);
  assert.equal(bad.status, 403);

  const ok = await call("PATCH", `/admin/people/${member.id}`, { hourlyRate: 1800 }, admin.id);
  assert.equal(ok.status, 200);
  assert.equal(ok.data.hourlyRate, 1800);
});

test("admin can read both sales and delivery APIs", async () => {
  const accounts = await call("GET", "/accounts", undefined, admin.id);
  assert.equal(accounts.status, 200);
  const projects = await call("GET", "/projects", undefined, admin.id);
  assert.equal(projects.status, 200);
});
