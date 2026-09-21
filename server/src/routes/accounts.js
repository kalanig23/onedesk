const router = require("express").Router();
const prisma = require("../db");
const { AppError } = require("../errors");
const { requireText, requireEmail, requireId } = require("../validate");

router.get("/", async (req, res) => {
  const accounts = await prisma.account.findMany({
    where: { isArchived: false },
    orderBy: { name: "asc" },
    include: { _count: { select: { contacts: true, deals: true, projects: true } } },
  });
  res.json(accounts);
});

router.post("/", async (req, res) => {
  const body = req.body ?? {};
  const name = requireText(body.name, "Company name");
  const industry = typeof body.industry === "string" && body.industry.trim() ? body.industry.trim() : null;

  try {
    const account = await prisma.account.create({ data: { name, industry } });
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
    include: { contacts: true, deals: true, projects: true },
  });
  if (!account) throw new AppError("Account not found.", 404, "NOT_FOUND");
  res.json(account);
});

// Delete nahi, archive: history (projects, hours) bachi rehti hai
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

module.exports = router;