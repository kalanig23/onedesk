const { test } = require("node:test");
const assert = require("node:assert");
const { buildProposalEmail, buildSpokeEmail } = require("./mail");

test("proposal email is addressed to the person we spoke to and lists the work", () => {
  const mail = buildProposalEmail({
    fromName: "Priya Sharma",
    contact: { name: "Meera Iyer", email: "meera@acme.test" },
    deal: {
      title: "POS rollout",
      expectedCloseDate: "2026-09-28",
      account: { name: "Acme Retail" },
      proposalItems: [
        { title: "Discovery", estimatedDays: 5, dailyRate: 20000 },
        { title: "Build", estimatedDays: 25, dailyRate: 20000 },
      ],
    },
  });
  assert.equal(mail.to, "meera@acme.test");
  assert.match(mail.subject, /POS rollout/);
  assert.match(mail.bodyText, /Meera Iyer/);
  assert.match(mail.bodyText, /Discovery/);
  assert.match(mail.bodyText, /30 days/);
});

test("spoke follow-up includes the call note", () => {
  const mail = buildSpokeEmail({
    fromName: "Priya Sharma",
    accountName: "Acme Retail",
    note: "They want a 40-day rollout",
    contact: { name: "Meera Iyer", email: "meera@acme.test" },
  });
  assert.equal(mail.to, "meera@acme.test");
  assert.match(mail.bodyText, /40-day rollout/);
});
