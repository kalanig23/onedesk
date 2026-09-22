const router = require("express").Router();
const prisma = require("../db");
const { AppError } = require("../errors");
const { salesOnly } = require("../authz");
const { changeStage } = require("../services/deals");
const { emailProposal } = require("../services/outbound");
const { isQuiet, buildForecast, proposalTotals } = require("../services/forecast");
const {
  requireText, requirePositiveNumber, requirePositiveInt, requireDate, requireId,
} = require("../validate");

router.use(salesOnly);

const listInclude = {
  account: { select: { id: true, name: true } },
  contact: {
    select: {
      id: true, name: true, email: true,
      lastSpokenAt: true, lastSpokenNote: true,
      lastSpokenBy: { select: { name: true } },
    },
  },
  project: { select: { id: true } },
  proposalItems: true,
  emails: {
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, kind: true, toEmail: true, toName: true, subject: true, bodyText: true, via: true, createdAt: true },
  },
};

function withFlags(deal) {
  return { ...deal, quiet: isQuiet(deal) };
}

router.get("/", async (req, res) => {
  const deals = await prisma.deal.findMany({
    orderBy: { expectedCloseDate: "asc" },
    include: listInclude,
  });
  res.json(deals.map(withFlags));
});

router.get("/forecast", async (req, res) => {
  const deals = await prisma.deal.findMany({
    include: listInclude,
  });
  const report = buildForecast(deals);
  res.json({
    quarter: report.quarter,
    start: report.start,
    end: report.end,
    likely: report.likely,
    unweighted: report.unweighted,
    deals: report.deals.map(withFlags),
    quiet: report.quiet.map(withFlags),
  });
});

router.post("/", async (req, res) => {
  const body = req.body ?? {};
  const accountId = requireId(body.accountId, "Account");
  const title = requireText(body.title, "Deal title");
  const expectedValue = requirePositiveInt(body.expectedValue, "Expected value", 2_000_000_000);
  const expectedDays = requirePositiveNumber(body.expectedDays, "Expected days", 3650);
  const expectedCloseDate = requireDate(body.expectedCloseDate, "Expected close date");
  const contactId = body.contactId ? requireId(body.contactId, "Contact") : null;

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new AppError("Account not found.", 404, "NOT_FOUND");
  if (account.isArchived) throw new AppError("This account is archived. Restore it before adding deals.");

  if (contactId) {
    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact || contact.accountId !== accountId) {
      throw new AppError("That person is not a contact at this company.");
    }
  }

  const dailyRate = Math.max(1, Math.round(expectedValue / expectedDays));

  const deal = await prisma.deal.create({
    data: {
      accountId, title, expectedValue, expectedDays, expectedCloseDate,
      ownerId: req.userId, contactId, lastActivityAt: new Date(),
      proposalItems: {
        create: { title, estimatedDays: expectedDays, dailyRate },
      },
    },
    include: listInclude,
  });
  res.status(201).json(withFlags(deal));
});

router.get("/:id", async (req, res) => {
  const id = requireId(req.params.id, "Deal id");
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      ...listInclude,
      history: { orderBy: { changedAt: "asc" }, include: { changedBy: { select: { name: true } } } },
    },
  });
  if (!deal) throw new AppError("Deal not found.", 404, "NOT_FOUND");
  res.json(withFlags(deal));
});

router.patch("/:id", async (req, res) => {
  const id = requireId(req.params.id, "Deal id");
  const deal = await prisma.deal.findUnique({ where: { id } });
  if (!deal) throw new AppError("Deal not found.", 404, "NOT_FOUND");
  if (deal.stage === "won") throw new AppError("A won deal cannot be edited. Delivery owns it now.");

  const body = req.body ?? {};
  const data = { lastActivityAt: new Date(), version: { increment: 1 } };
  if (body.contactId !== undefined) {
    if (body.contactId === null || body.contactId === "") {
      data.contactId = null;
    } else {
      const contactId = requireId(body.contactId, "Contact");
      const contact = await prisma.contact.findUnique({ where: { id: contactId } });
      if (!contact || contact.accountId !== deal.accountId) {
        throw new AppError("That person is not a contact at this company.");
      }
      data.contactId = contactId;
    }
  }
  if (body.title !== undefined) data.title = requireText(body.title, "Deal title");
  if (body.expectedValue !== undefined) data.expectedValue = requirePositiveInt(body.expectedValue, "Expected value", 2_000_000_000);
  if (body.expectedDays !== undefined) data.expectedDays = requirePositiveNumber(body.expectedDays, "Expected days", 3650);
  if (body.expectedCloseDate !== undefined) data.expectedCloseDate = requireDate(body.expectedCloseDate, "Expected close date");

  const updated = await prisma.deal.update({ where: { id }, data, include: listInclude });
  res.json(withFlags(updated));
});

router.delete("/:id", async (req, res) => {
  const id = requireId(req.params.id, "Deal id");
  const deal = await prisma.deal.findUnique({ where: { id }, include: { project: { select: { id: true } } } });
  if (!deal) throw new AppError("Deal not found.", 404, "NOT_FOUND");
  if (deal.stage === "won" || deal.project) {
    throw new AppError("A won deal cannot be deleted. Delivery already has a project for it.", 409, "HAS_PROJECT");
  }
  await prisma.deal.delete({ where: { id } });
  res.json({ ok: true });
});

router.post("/:id/proposal-items", async (req, res) => {
  const dealId = requireId(req.params.id, "Deal id");
  const body = req.body ?? {};
  const title = requireText(body.title, "Work item");
  const estimatedDays = requirePositiveNumber(body.estimatedDays, "Estimated days", 3650);
  const dailyRate = requirePositiveInt(body.dailyRate, "Daily rate", 2_000_000);

  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) throw new AppError("Deal not found.", 404, "NOT_FOUND");
  if (deal.stage === "won" || deal.stage === "lost") {
    throw new AppError("This deal is closed. Reopen it before changing the proposal.");
  }

  await prisma.proposalItem.create({ data: { dealId, title, estimatedDays, dailyRate } });
  const items = await prisma.proposalItem.findMany({ where: { dealId } });
  const totals = deal.stage === "proposal_sent" ? proposalTotals(items) : {};
  const updated = await prisma.deal.update({
    where: { id: dealId },
    data: { ...totals, lastActivityAt: new Date() },
    include: listInclude,
  });
  res.status(201).json(withFlags(updated));
});

router.patch("/:id/proposal-items/:itemId", async (req, res) => {
  const dealId = requireId(req.params.id, "Deal id");
  const itemId = requireId(req.params.itemId, "Work item");
  const item = await prisma.proposalItem.findUnique({ where: { id: itemId } });
  if (!item || item.dealId !== dealId) throw new AppError("Work item not found.", 404, "NOT_FOUND");

  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) throw new AppError("Deal not found.", 404, "NOT_FOUND");
  if (deal.stage === "won" || deal.stage === "lost") {
    throw new AppError("This deal is closed. Reopen it before changing the proposal.");
  }

  const body = req.body ?? {};
  const data = {};
  if (body.title !== undefined) data.title = requireText(body.title, "Work item");
  if (body.estimatedDays !== undefined) data.estimatedDays = requirePositiveNumber(body.estimatedDays, "Estimated days", 3650);
  if (body.dailyRate !== undefined) data.dailyRate = requirePositiveInt(body.dailyRate, "Daily rate", 2_000_000);
  if (Object.keys(data).length === 0) throw new AppError("Nothing to update.");

  await prisma.proposalItem.update({ where: { id: itemId }, data });
  const items = await prisma.proposalItem.findMany({ where: { dealId } });
  const totals = deal.stage === "proposal_sent" ? proposalTotals(items) : {};
  const updated = await prisma.deal.update({
    where: { id: dealId },
    data: { ...totals, lastActivityAt: new Date() },
    include: listInclude,
  });
  res.json(withFlags(updated));
});

router.delete("/:id/proposal-items/:itemId", async (req, res) => {
  const dealId = requireId(req.params.id, "Deal id");
  const itemId = requireId(req.params.itemId, "Work item");
  const item = await prisma.proposalItem.findUnique({ where: { id: itemId } });
  if (!item || item.dealId !== dealId) throw new AppError("Work item not found.", 404, "NOT_FOUND");

  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (deal.stage === "won") throw new AppError("A won deal cannot be edited. Delivery owns it now.");

  await prisma.proposalItem.delete({ where: { id: itemId } });
  const items = await prisma.proposalItem.findMany({ where: { dealId } });
  const totals = deal.stage === "proposal_sent" ? proposalTotals(items) : {};
  const updated = await prisma.deal.update({
    where: { id: dealId },
    data: { ...totals, lastActivityAt: new Date() },
    include: listInclude,
  });
  res.json(withFlags(updated));
});

router.post("/:id/send-proposal", async (req, res) => {
  const id = requireId(req.params.id, "Deal id");
  const body = req.body ?? {};
  const version = body.version === undefined ? undefined : Number(body.version);
  const result = await emailProposal(id, {
    userId: req.userId,
    version,
    fromName: req.user?.name,
  });
  res.json(result);
});

router.post("/:id/stage", async (req, res) => {
  const id = requireId(req.params.id, "Deal id");
  const body = req.body ?? {};
  const stage = requireText(body.stage, "Stage");
  const lostReason = typeof body.lostReason === "string" ? body.lostReason : undefined;
  const version = body.version === undefined ? undefined : Number(body.version);

  const result = await changeStage(id, stage, { lostReason, userId: req.userId, version });
  res.json(result);
});

module.exports = router;
