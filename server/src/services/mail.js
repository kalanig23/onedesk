function rupees(n) {
  return "Rs " + Math.round(Number(n) || 0).toLocaleString("en-IN");
}

function days(n) {
  return String(Math.round((Number(n) || 0) * 10) / 10);
}

function buildProposalEmail({ deal, contact, fromName }) {
  const items = deal.proposalItems || [];
  const totalDays = items.reduce((s, i) => s + Number(i.estimatedDays), 0);
  const totalAmount = items.reduce((s, i) => s + Number(i.estimatedDays) * Number(i.dailyRate), 0);
  const sender = fromName || "Brightpath";
  const lines = items.map(
    (i) => `- ${i.title}: ${days(i.estimatedDays)} days @ ${rupees(i.dailyRate)}/day = ${rupees(i.estimatedDays * i.dailyRate)}`,
  );
  const subject = `Proposal: ${deal.title} — ${deal.account.name}`;
  const bodyText = [
    `Hi ${contact.name},`,
    "",
    `${sender} here from Brightpath. Following our conversation, here is the proposal for ${deal.title}.`,
    "",
    ...lines,
    "",
    `Total: ${days(totalDays)} days · ${rupees(totalAmount)}`,
    deal.expectedCloseDate
      ? `We are aiming to start around ${String(deal.expectedCloseDate).slice(0, 10)}.`
      : "",
    "",
    "Reply to this email if you would like to change the scope or go ahead.",
    "",
    `Thanks,`,
    sender,
    "Brightpath Consulting",
  ].filter((x) => x !== "").join("\n");

  return { to: contact.email, toName: contact.name, subject, bodyText };
}

function buildSpokeEmail({ contact, fromName, note, accountName }) {
  const sender = fromName || "Brightpath";
  const subject = `Good speaking with you${accountName ? ` — ${accountName}` : ""}`;
  const bodyText = [
    `Hi ${contact.name},`,
    "",
    `${sender} here from Brightpath. Thank you for the conversation today.`,
    note ? `Notes from our call: ${note}` : "",
    "",
    "I will send a written proposal with estimated days and rates when the scope is clear.",
    "",
    `Thanks,`,
    sender,
    "Brightpath Consulting",
  ].filter((x) => x !== "").join("\n");
  return { to: contact.email, toName: contact.name, subject, bodyText };
}

async function deliver({ to, subject, bodyText }) {
  const host = process.env.SMTP_HOST;
  const from = process.env.MAIL_FROM || "OneDesk <onedesk@brightpath.test>";
  if (!host) {
    return { via: "outbox" };
  }
  const nodemailer = require("nodemailer");
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
      : undefined,
  });
  await transporter.sendMail({ from, to, subject, text: bodyText });
  return { via: "smtp" };
}

module.exports = { rupees, buildProposalEmail, buildSpokeEmail, deliver };
