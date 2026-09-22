const prisma = require("../db");
const { AppError } = require("../errors");
const { changeStage } = require("./deals");
const { buildProposalEmail, buildSpokeEmail, deliver } = require("./mail");

async function saveAndSend({ kind, dealId, contact, fromName, payload }) {
  const { via } = await deliver(payload);
  const row = await prisma.outboundEmail.create({
    data: {
      kind,
      dealId: dealId ?? null,
      contactId: contact.id,
      toEmail: payload.to,
      toName: payload.toName,
      subject: payload.subject,
      bodyText: payload.bodyText,
      via,
    },
  });
  return { email: row, via, fromName };
}

async function emailProposal(dealId, { userId, version, fromName }) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      account: true,
      proposalItems: true,
      contact: true,
    },
  });
  if (!deal) throw new AppError("Deal not found.", 404, "NOT_FOUND");
  if (deal.stage === "won" || deal.stage === "lost") {
    throw new AppError("This deal is closed. Reopen it before emailing a proposal.");
  }
  if (!deal.contact) {
    throw new AppError("Pick who you spoke to before emailing the proposal.");
  }
  if (!deal.contact.email) {
    throw new AppError("That contact has no email address.");
  }
  if (deal.proposalItems.length === 0) {
    throw new AppError("Add at least one work item (days and rate) before sending a proposal.");
  }

  const payload = buildProposalEmail({ deal, contact: deal.contact, fromName });
  const sent = await saveAndSend({
    kind: "proposal",
    dealId,
    contact: deal.contact,
    fromName,
    payload,
  });

  let stage = { deal };
  if (deal.stage === "qualified") {
    stage = await changeStage(dealId, "proposal_sent", { userId, version });
  } else if (deal.stage === "new") {
    throw new AppError("Qualify the deal first, then email the proposal to the person you spoke to.");
  } else {
    await prisma.deal.update({
      where: { id: dealId },
      data: { lastActivityAt: new Date() },
    });
    stage = { deal: await prisma.deal.findUnique({ where: { id: dealId } }) };
  }

  return {
    deal: stage.deal,
    project: stage.project ?? null,
    sent: {
      id: sent.email.id,
      to: sent.email.toEmail,
      toName: sent.email.toName,
      subject: sent.email.subject,
      bodyText: sent.email.bodyText,
      via: sent.via,
    },
  };
}

async function emailSpoke(contact, { fromName, note, accountName, dealId }) {
  if (!contact.email) throw new AppError("That contact has no email address.");
  const payload = buildSpokeEmail({ contact, fromName, note, accountName });
  const sent = await saveAndSend({
    kind: "spoke",
    dealId: dealId ?? null,
    contact,
    fromName,
    payload,
  });
  return {
    id: sent.email.id,
    to: sent.email.toEmail,
    toName: sent.email.toName,
    subject: sent.email.subject,
    bodyText: sent.email.bodyText,
    via: sent.via,
  };
}

module.exports = { emailProposal, emailSpoke };
