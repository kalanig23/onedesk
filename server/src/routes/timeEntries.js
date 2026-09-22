const router = require("express").Router();
const prisma = require("../db");
const { AppError } = require("../errors");
const { deliveryOnly } = require("../authz");
const { logTime, updateTime, deleteTime } = require("../services/timeEntries");
const { requireId } = require("../validate");

router.use(deliveryOnly);

router.post("/", async (req, res) => {
  const entry = await logTime(req.userId, req.body);
  res.status(201).json(entry);
});

// "Meri entries": pichle 30 din
router.get("/mine", async (req, res) => {
  if (!req.userId) throw new AppError("Please log in first.", 401, "NOT_SIGNED_IN");
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const entries = await prisma.timeEntry.findMany({
    where: { userId: req.userId, date: { gte: since } },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    include: { task: { select: { title: true, project: { select: { id: true, name: true } } } } },
  });
  res.json(entries);
});

// Log-time dropdown ke liye: jin active projects par ye banda hai, unke tasks
router.get("/options", async (req, res) => {
  if (!req.userId) throw new AppError("Please log in first.", 401, "NOT_SIGNED_IN");
  const projects = await prisma.project.findMany({
    where: { status: "active", members: { some: { userId: req.userId } } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      tasks: {
        where: { assigneeId: req.userId },
        orderBy: { id: "asc" },
        select: { id: true, title: true },
      },
    },
  });
  res.json(projects.filter((p) => p.tasks.length > 0));
});

router.patch("/:id", async (req, res) => {
  const id = requireId(req.params.id, "Time entry");
  const entry = await updateTime(req.userId, id, req.body ?? {});
  res.json(entry);
});

router.delete("/:id", async (req, res) => {
  const id = requireId(req.params.id, "Time entry");
  res.json(await deleteTime(req.userId, id));
});

module.exports = router;