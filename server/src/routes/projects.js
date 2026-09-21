const router = require("express").Router();
const prisma = require("../db");
const { AppError } = require("../errors");
const { calculateBudget } = require("../services/budget");
const { requireText, requireId } = require("../validate");

const entrySelect = { hours: true, billable: true, rateAtEntry: true };

async function assertMember(projectId, userId) {
  const m = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!m) throw new AppError("That person is not on this project. Add them to the project first.");
}

// Sab projects, budget ke summary ke saath
router.get("/", async (req, res) => {
  const projects = await prisma.project.findMany({
    orderBy: { id: "asc" },
    include: {
      account: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true } },
      tasks: { select: { timeEntries: { select: entrySelect } } },
    },
  });
  res.json(
    projects.map((p) => ({
      id: p.id, name: p.name, status: p.status, account: p.account, manager: p.manager,
      budget: calculateBudget(p, p.tasks.flatMap((t) => t.timeEntries)),
    }))
  );
});

// Ek project: members, tasks aur budget vs actual
router.get("/:id", async (req, res) => {
  const id = requireId(req.params.id, "Project id");
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      account: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true } },
      members: { include: { user: { select: { id: true, name: true } } } },
      tasks: {
        orderBy: { id: "asc" },
        include: { assignee: { select: { id: true, name: true } }, timeEntries: { select: entrySelect } },
      },
    },
  });
  if (!project) throw new AppError("Project not found.", 404, "NOT_FOUND");

  const budget = calculateBudget(project, project.tasks.flatMap((t) => t.timeEntries));
  const tasks = project.tasks.map(({ timeEntries, ...t }) => ({
    ...t,
    loggedHours: timeEntries.reduce((s, e) => s + e.hours, 0),
  }));
  res.json({ ...project, tasks, budget });
});

// Sirf budget vs actual
router.get("/:id/budget", async (req, res) => {
  const id = requireId(req.params.id, "Project id");
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw new AppError("Project not found.", 404, "NOT_FOUND");
  const entries = await prisma.timeEntry.findMany({
    where: { task: { projectId: id } },
    select: entrySelect,
  });
  res.json(calculateBudget(project, entries));
});

router.post("/:id/members", async (req, res) => {
  const projectId = requireId(req.params.id, "Project id");
  const userId = requireId(req.body?.userId, "Person");
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError("Project not found.", 404, "NOT_FOUND");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("That person does not exist.", 404, "NOT_FOUND");

  const member = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    update: {},
    create: { projectId, userId },
  });
  res.status(201).json(member);
});

router.post("/:id/tasks", async (req, res) => {
  const projectId = requireId(req.params.id, "Project id");
  const title = requireText(req.body?.title, "Task title");
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError("Project not found.", 404, "NOT_FOUND");
  if (project.status === "closed") throw new AppError("This project is closed. Reopen it to add tasks.", 409, "PROJECT_CLOSED");

  let assigneeId = null;
  if (req.body?.assigneeId) {
    assigneeId = requireId(req.body.assigneeId, "Assignee");
    await assertMember(projectId, assigneeId);
  }
  const task = await prisma.task.create({ data: { projectId, title, assigneeId } });
  res.status(201).json(task);
});

router.post("/:id/status", async (req, res) => {
  const id = requireId(req.params.id, "Project id");
  const status = req.body?.status;
  if (!["active", "closed"].includes(status)) {
    throw new AppError("Status must be active or closed.");
  }
  const found = await prisma.project.findUnique({ where: { id } });
  if (!found) throw new AppError("Project not found.", 404, "NOT_FOUND");
  res.json(await prisma.project.update({ where: { id }, data: { status } }));
});

module.exports = router;