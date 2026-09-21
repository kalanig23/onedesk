const router = require("express").Router();
const prisma = require("../db");
const { AppError } = require("../errors");
const { logTime } = require("../services/timeEntries");

router.post("/", async (req, res) => {
  const entry = await logTime(req.userId, req.body);
  res.status(201).json(entry);
});

// "Meri entries": pichle 30 din
router.get("/mine", async (req, res) => {
  if (!req.userId) throw new AppError("Choose who you are from the user menu first.", 401, "NOT_SIGNED_IN");
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const entries = await prisma.timeEntry.findMany({
    where: { userId: req.userId, date: { gte: since } },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    include: { task: { select: { title: true, project: { select: { id: true, name: true } } } } },
  });
  res.json(entries);
});

module.exports = router;