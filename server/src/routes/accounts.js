const router = require("express").Router();
const prisma = require("../db");
const { AppError } = require("../errors");
const { salesOnly } = require("../authz");
const { requireText, requireEmail, requireId } = require("../validate");
const { emailSpoke } = require("../services/outbound");

router.use(salesOnly);

router.get("/", async (req, res) => {
  const accounts = await prisma.account.findMany({
    where: { isArchived: false },
    orderBy: { name: "asc" },
    include: {
      contacts: { orderBy: { name: "asc" }, select: { id: true, name: true, email: true } },
      _count: { select: { contacts: true, deals: true, projects: true } },
    },
  });
  res.json(accounts);
});

router.post("/", async (req, res) => {
  const body = req.body ?? {};
  const name = requireText(body.name, "Company name");
  const industry = typeof body.industry === "string" && body.industry.trim() ? body.industry.trim() : null;
  const hasContact = Boolean(body.contactName || body.contactEmail);
  const contactName = hasContact ? requireText(body.contactName, "Spoke-to name") : null;
  const contactEmail = hasContact ? requireEmail(body.contactEmail, "Spoke-to email") : null;
  const contactPhone = typeof body.contactPhone === "string" && body.contactPhone.trim() ? body.contactPhone.trim() : null;

  try {
    const account = await prisma.account.create({
      data: {
        name,
        industry,
        contacts: contactName
          ? { create: { name: contactName, email: contactEmail, phone: contactPhone } }
          : undefined,
      },
      include: {
        contacts: { select: { id: true, name: true, email: true } },
        _count: { select: { contacts: true, deals: true, projects: true } },
      },
    });
    res.status(201).json(account);
  } catch (e) {
    if (e.code === "P2002") {
      throw new AppError("An account with this name already exists.", 409, "DUPLICATE");
    }
    throw e;
  }
});

router.get("/:id", async (req, res) => {
  const id = requireId(req.params.id, "Account id");
  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      contacts: {
        orderBy: { name: "asc" },
        include: { lastSpokenBy: { select: { id: true, name: true } } },
      },
      deals: { orderBy: { expectedCloseDate: "asc" }, include: { contact: { select: { name: true } } } },
    },
  });
  if (!account) throw new AppError("Account not found.", 404, "NOT_FOUND");
  res.json(account);
});

router.patch("/:id", async (req, res) => {
  const id = requireId(req.params.id, "Account id");
  const found = await prisma.account.findUnique({ where: { id } });
  if (!found) throw new AppError("Account not found.", 404, "NOT_FOUND");

  const body = req.body ?? {};
  const data = {};
  if (body.name !== undefined) data.name = requireText(body.name, "Company name");
  if (body.industry !== undefined) {
    data.industry = typeof body.industry === "string" && body.industry.trim() ? body.industry.trim() : null;
  }
  if (Object.keys(data).length === 0) throw new AppError("Nothing to update.");

  try {
    const account = await prisma.account.update({ where: { id }, data });
    res.json(account);
  } catch (e) {
    if (e.code === "P2002") {
      throw new AppError("An account with this name already exists.", 409, "DUPLICATE");
    }
    throw e;
  }
});

router.delete("/:id", async (req, res) => {
  const id = requireId(req.params.id, "Account id");
  const found = await prisma.account.findUnique({ where: { id } });
  if (!found) throw new AppError("Account not found.", 404, "NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    await tx.timeEntry.deleteMany({ where: { task: { project: { accountId: id } } } });
    await tx.task.deleteMany({ where: { project: { accountId: id } } });
    await tx.projectMember.deleteMany({ where: { project: { accountId: id } } });
    await tx.project.deleteMany({ where: { accountId: id } });
    await tx.dealStageChange.deleteMany({ where: { deal: { accountId: id } } });
    await tx.outboundEmail.deleteMany({
      where: { OR: [{ deal: { accountId: id } }, { contact: { accountId: id } }] },
    });
    await tx.proposalItem.deleteMany({ where: { deal: { accountId: id } } });
    await tx.deal.deleteMany({ where: { accountId: id } });
    await tx.contact.deleteMany({ where: { accountId: id } });
    await tx.account.delete({ where: { id } });
  });
  res.json({ ok: true });
});

router.post("/:id/archive", async (req, res) => {
  const id = requireId(req.params.id, "Account id");
  const found = await prisma.account.findUnique({ where: { id } });
  if (!found) throw new AppError("Account not found.", 404, "NOT_FOUND");
  const account = await prisma.account.update({ where: { id }, data: { isArchived: true } });
  res.json(account);
});

router.post("/:id/contacts", async (req, res) => {
  const accountId = requireId(req.params.id, "Account id");
  const body = req.body ?? {};
  const name = requireText(body.name, "Contact name");
  const email = requireEmail(body.email, "Contact email");
  const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new AppError("Account not found.", 404, "NOT_FOUND");

  const contact = await prisma.contact.create({ data: { accountId, name, email, phone } });
  res.status(201).json(contact);
});

router.post("/:id/contacts/:contactId/spoke", async (req, res) => {
  const accountId = requireId(req.params.id, "Account id");
  const contactId = requireId(req.params.contactId, "Contact id");
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 300) : "";
  const sendEmail = req.body?.email === true;

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact || contact.accountId !== accountId) throw new AppError("Contact not found.", 404, "NOT_FOUND");

  const updated = await prisma.contact.update({
    where: { id: contactId },
    data: {
      lastSpokenAt: new Date(),
      lastSpokenNote: note || null,
      lastSpokenById: req.userId,
    },
    include: { lastSpokenBy: { select: { id: true, name: true } } },
  });

  await prisma.deal.updateMany({
    where: { contactId, stage: { notIn: ["won", "lost"] } },
    data: { lastActivityAt: new Date() },
  });

  let sent = null;
  if (sendEmail) {
    const account = await prisma.account.findUnique({ where: { id: accountId }, select: { name: true } });
    const open = await prisma.deal.findFirst({
      where: { contactId, stage: { notIn: ["won", "lost"] } },
      select: { id: true },
      orderBy: { id: "desc" },
    });
    sent = await emailSpoke(updated, {
      fromName: req.user?.name,
      note,
      accountName: account?.name,
      dealId: open?.id ?? null,
    });
  }

  res.json({ ...updated, sent });
});

router.patch("/:id/contacts/:contactId", async (req, res) => {
  const accountId = requireId(req.params.id, "Account id");
  const contactId = requireId(req.params.contactId, "Contact id");
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact || contact.accountId !== accountId) throw new AppError("Contact not found.", 404, "NOT_FOUND");

  const body = req.body ?? {};
  const data = {};
  if (body.name !== undefined) data.name = requireText(body.name, "Contact name");
  if (body.email !== undefined) data.email = requireEmail(body.email, "Contact email");
  if (body.phone !== undefined) {
    data.phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  }
  if (Object.keys(data).length === 0) throw new AppError("Nothing to update.");

  const updated = await prisma.contact.update({
    where: { id: contactId },
    data,
    include: { lastSpokenBy: { select: { id: true, name: true } } },
  });
  res.json(updated);
});

router.delete("/:id/contacts/:contactId", async (req, res) => {
  const accountId = requireId(req.params.id, "Account id");
  const contactId = requireId(req.params.contactId, "Contact id");
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact || contact.accountId !== accountId) throw new AppError("Contact not found.", 404, "NOT_FOUND");
  await prisma.contact.delete({ where: { id: contactId } });
  res.json({ ok: true });
});

module.exports = router;
