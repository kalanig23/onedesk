const router = require("express").Router();
const prisma = require("../db");
const { AppError } = require("../errors");
const { changeStage } = require("../services/deals");
const {
  requireText, requirePositiveNumber, requirePositiveInt, requireDate, requireId,
} = require("../validate");

router.get("/", async (req, res) => {
  const deals = await prisma.deal.findMany({
    orderBy: { expectedCloseDate: "asc" },
    include: { account: { select: { id: true, name: true } }, project: { select: { id: true } } },
  });
  res.json(deals);
});

router.post("/", async (req, res) => {
  const body = req.body ?? {};
  const accountId = requireId(body.accountId, "Account");
  const title = requireText(body.title, "Deal title");
  const expectedValue = requirePositiveInt(body.expectedValue, "Expected value", 2_000_000_000);
  const expectedDays = requirePositiveNumber(body.expectedDays, "Expected days", 3650);
  const expectedCloseDate = requireDate(body.expectedCloseDate, "Expected close date");

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new AppError("Account not found.", 404, "NOT_FOUND");
  if (account.isArchived) throw new AppError("This account is archived. Restore it before adding deals.");

  const deal = await prisma.deal.create({
    data: { accountId, title, expectedValue, expectedDays, expectedCloseDate, ownerId: req.userId },
  });
  res.status(201).json(deal);
});

router.get("/:id", async (req, res) => {
  const id = requireId(req.params.id, "Deal id");
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      account: true,
      project: true,
      history: { orderBy: { changedAt: "asc" }, include: { changedBy: { select: { name: true } } } },
    },
  });
  if (!deal) throw new AppError("Deal not found.", 404, "NOT_FOUND");
  res.json(deal);
});

// Stage badlo. Won par project khud banta hai (services/deals.js mein)
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