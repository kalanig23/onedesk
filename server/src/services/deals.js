const prisma = require("../db");
const { AppError } = require("../errors");
const { validateStageChange } = require("./dealRules");

// Deal ka stage badalta hai. Won hone par project bhi banata hai.
// options: { lostReason, userId (kisne badla), version (screen ne kaunsa version dekha tha) }
async function changeStage(dealId, toStage, options = {}) {
  const { lostReason, userId, version } = options;

  // $transaction: andar ka sab kuch ek saath hoga, ya kuch bhi nahi.
  // Beech mein error aaya to sab wapas (rollback).
  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.findUnique({
      where: { id: dealId },
      include: { account: true },
    });
    if (!deal) throw new AppError("Deal not found.", 404, "NOT_FOUND");

    // Screen ne purana version dikhaya tha, matlab kisi aur ne beech mein badal diya
    if (version !== undefined && version !== deal.version) {
      throw new AppError(
        "Someone else changed this deal while you were looking at it. Please refresh and try again.",
        409,
        "CONFLICT"
      );
    }

    // Stage ke rules (skip nahi, Lost ko reason chahiye, Won/Lost final)
    validateStageChange(deal.stage, toStage, lostReason);

    // Sirf tab update karo jab version abhi bhi wahi ho.
    // Do log ek saath karein to ek ko count = 0 milta hai.
    const result = await tx.deal.updateMany({
      where: { id: dealId, version: deal.version },
      data: {
        stage: toStage,
        lostReason: toStage === "lost" ? lostReason.trim() : null,
        version: { increment: 1 },
      },
    });
    if (result.count === 0) {
      throw new AppError(
        "Someone else changed this deal at the same time. Please refresh and try again.",
        409,
        "CONFLICT"
      );
    }

    // Stage history: kisne, kab, kahan se kahan
    await tx.dealStageChange.create({
      data: {
        dealId,
        fromStage: deal.stage,
        toStage,
        changedById: userId ?? null,
      },
    });

    // Hinge: Won hone par project banta hai, sold scope COPY hota hai
    let project = null;
    if (toStage === "won") {
      project = await tx.project.create({
        data: {
          dealId,
          accountId: deal.accountId,
          name: `${deal.account.name} - ${deal.title}`,
          budgetDays: deal.expectedDays, // copy, pointer nahi
          budgetAmount: deal.expectedValue, // copy, pointer nahi
        },
      });
    }

    const updatedDeal = await tx.deal.findUnique({ where: { id: dealId } });
    return { deal: updatedDeal, project };
  });
}

module.exports = { changeStage };