const prisma = require("../db");
const { AppError } = require("../errors");
const { validateStageChange } = require("./dealRules");
const { proposalTotals } = require("./forecast");

async function changeStage(dealId, toStage, options = {}) {
  const { lostReason, userId, version } = options;

  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.findUnique({
      where: { id: dealId },
      include: { account: true, proposalItems: true },
    });
    if (!deal) throw new AppError("Deal not found.", 404, "NOT_FOUND");

    if (version !== undefined && version !== deal.version) {
      throw new AppError(
        "Someone else changed this deal while you were looking at it. Please refresh and try again.",
        409,
        "CONFLICT"
      );
    }

    validateStageChange(deal.stage, toStage, lostReason);

    const extra = { lastActivityAt: new Date() };
    if (toStage === "lost") extra.lostReason = lostReason.trim();
    if (toStage === "new" && deal.stage === "lost") extra.lostReason = null;

    if (toStage === "proposal_sent") {
      if (deal.proposalItems.length === 0) {
        throw new AppError("Add at least one work item (days and rate) before sending a proposal.");
      }
      Object.assign(extra, proposalTotals(deal.proposalItems));
    }

    const result = await tx.deal.updateMany({
      where: { id: dealId, version: deal.version },
      data: {
        stage: toStage,
        version: { increment: 1 },
        ...extra,
      },
    });
    if (result.count === 0) {
      throw new AppError(
        "Someone else changed this deal at the same time. Please refresh and try again.",
        409,
        "CONFLICT"
      );
    }

    await tx.dealStageChange.create({
      data: {
        dealId,
        fromStage: deal.stage,
        toStage,
        changedById: userId ?? null,
      },
    });

    let project = null;
    if (toStage === "won") {
      const fresh = await tx.deal.findUnique({ where: { id: dealId } });
      project = await tx.project.create({
        data: {
          dealId,
          accountId: deal.accountId,
          name: `${deal.account.name} - ${deal.title}`,
          budgetDays: fresh.expectedDays,
          budgetAmount: fresh.expectedValue,
        },
      });
    }

    const updatedDeal = await tx.deal.findUnique({ where: { id: dealId } });
    return { deal: updatedDeal, project };
  });
}

module.exports = { changeStage };
