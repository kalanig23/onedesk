const router = require("express").Router();
const prisma = require("../db");
const { AppError } = require("../errors");
const { deliveryOnly, canManageDelivery } = require("../authz");
const { calculateBudget, draftInvoice } = require("../services/budget");
const { requireText, requireId } = require("../validate");

router.use(deliveryOnly);

const entrySelect = {
  id: true,
  hours: true,
  billable: true,
  rateAtEntry: true,
  date: true,
  user: { select: { id: true, name: true } },
};

function taskProgress(tasks) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const todo = tasks.filter((t) => t.status === "todo").length;
  return {
    total,
    done,
    inProgress,
    todo,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

async function assertMember(projectId, userId) {
  const m = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!m) throw new AppError("That person is not on this project. Add them to the project first.");
}

async function loadProjectOrThrow(id) {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw new AppError("Project not found.", 404, "NOT_FOUND");
  return project;
}

async function assertCanView(req, projectId) {
  const project = await loadProjectOrThrow(projectId);
  if (canManageDelivery(req.user)) return project;
  const m = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: req.userId } },
  });
  if (!m) throw new AppError("You are not on this project.", 403, "NOT_A_MEMBER");
  return project;
}

function assertCanManage(req) {
  if (!canManageDelivery(req.user)) {
    throw new AppError("Only a manager can assign work and change the team.", 403, "FORBIDDEN");
  }
}

router.get("/", async (req, res) => {
  const where = canManageDelivery(req.user)
    ? {}
    : { members: { some: { userId: req.userId } } };
  const projects = await prisma.project.findMany({
    where,
    orderBy: { id: "asc" },
    include: {
      account: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true } },
      tasks: { select: { status: true, timeEntries: { select: entrySelect } } },
    },
  });
  res.json(
    projects.map((p) => ({
      id: p.id, name: p.name, status: p.status, account: p.account, manager: p.manager,
      budget: calculateBudget(p, p.tasks.flatMap((t) => t.timeEntries)),
      progress: taskProgress(p.tasks),
    }))
  );
});

router.get("/:id", async (req, res) => {
  const id = requireId(req.params.id, "Project id");
  await assertCanView(req, id);
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      account: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true } },
      members: { include: { user: { select: { id: true, name: true, role: true } } } },
      tasks: {
        orderBy: { id: "asc" },
        include: { assignee: { select: { id: true, name: true } }, timeEntries: { select: entrySelect } },
      },
    },
  });
  if (!project) throw new AppError("Project not found.", 404, "NOT_FOUND");

  const allEntries = project.tasks.flatMap((t) => t.timeEntries);
  const budget = calculateBudget(project, allEntries);
  const invoice = draftInvoice(allEntries);
  const tasks = project.tasks.map(({ timeEntries, ...t }) => ({
    ...t,
    loggedHours: timeEntries.reduce((s, e) => s + e.hours, 0),
  }));
  res.json({
    ...project,
    tasks,
    budget,
    invoice,
    progress: taskProgress(tasks),
    canManage: canManageDelivery(req.user),
  });
});

router.get("/:id/budget", async (req, res) => {
  const id = requireId(req.params.id, "Project id");
  await assertCanView(req, id);
  const project = await loadProjectOrThrow(id);
  const entries = await prisma.timeEntry.findMany({
    where: { task: { projectId: id } },
    select: entrySelect,
  });
  res.json(calculateBudget(project, entries));
});

router.post("/:id/members", async (req, res) => {
  assertCanManage(req);
  const projectId = requireId(req.params.id, "Project id");
  const userId = requireId(req.body?.userId, "Person");
  await loadProjectOrThrow(projectId);
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
  assertCanManage(req);
  const projectId = requireId(req.params.id, "Project id");
  const title = requireText(req.body?.title, "Task title");
  const project = await loadProjectOrThrow(projectId);
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
  assertCanManage(req);
  const id = requireId(req.params.id, "Project id");
  const status = req.body?.status;
  if (!["active", "closed"].includes(status)) {
    throw new AppError("Status must be active or closed.");
  }
  await loadProjectOrThrow(id);
  res.json(await prisma.project.update({ where: { id }, data: { status } }));
});

module.exports = router;
