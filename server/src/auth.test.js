const { test, before, after } = require("node:test");
const assert = require("node:assert");
const app = require("./app");
const prisma = require("./db");

const stamp = Date.now();
const email = `auth-${stamp}@test.local`;
let server;
let base;
let createdId;

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
});

after(async () => {
  if (createdId) await prisma.user.delete({ where: { id: createdId } }).catch(() => {});
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

test("register needs a role, hourly rate, and a strong-enough password", async () => {
  const missingRole = await call("POST", "/auth/register", {
    name: "Patel", email, password: "secret1", hourlyRate: 1500,
  });
  assert.equal(missingRole.status, 400);
  assert.match(missingRole.data.error.message, /Role/);

  const missingRate = await call("POST", "/auth/register", {
    name: "Patel", email, password: "secret1", role: "member",
  });
  assert.equal(missingRate.status, 400);
  assert.match(missingRate.data.error.message, /Hourly rate/);

  const short = await call("POST", "/auth/register", {
    name: "Patel", email, password: "ab", role: "member", hourlyRate: 1500,
  });
  assert.equal(short.status, 400);
  assert.match(short.data.error.message, /6 characters/);
});

test("register then login returns the user without a password hash", async () => {
  const created = await call("POST", "/auth/register", {
    name: "Auth Patel", email, password: "secret1", role: "manager", hourlyRate: 1800,
  });
  assert.equal(created.status, 201);
  createdId = created.data.id;
  assert.equal(created.data.email, email);
  assert.equal(created.data.role, "manager");
  assert.equal(created.data.hourlyRate, 1800);
  assert.equal(created.data.passwordHash, undefined);

  const dup = await call("POST", "/auth/register", {
    name: "Other", email, password: "secret1", role: "sales", hourlyRate: 1500,
  });
  assert.equal(dup.status, 409);

  const bad = await call("POST", "/auth/login", { email, password: "wrong-password" });
  assert.equal(bad.status, 401);

  const ok = await call("POST", "/auth/login", { email, password: "secret1" });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.id, createdId);
  assert.equal(ok.data.role, "manager");

  const me = await call("GET", "/auth/me", undefined, createdId);
  assert.equal(me.status, 200);
  assert.equal(me.data.name, "Auth Patel");
});
