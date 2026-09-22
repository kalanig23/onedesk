const router = require("express").Router();
const prisma = require("../db");
const { AppError } = require("../errors");
const { deliveryOnly, canManageDelivery } = require("../authz");
const { requireId, requireText } = require("../validate");

router.use(deliveryOnly);

async function loadTask(id) {
  const task = await prisma.task.findUnique({
    where: { id },
    include: { project: { select: { id: true, managerId: true, status: true } } },
  });
  if (!task) throw new AppError("Task not found.", 404, "NOT_FOUND");
  return task;
}

router.patch("/:id", async (req, res) => {
  const id = requireId(req.params.id, "Task id");
  const task = await loadTask(id);
  const manage = canManageDelivery(req.user);
  const own = task.assigneeId === req.userId;
  const data = {};
  const body = req.body ?? {};

  if (body.status !== undefined) {
    if (!["todo", "in_progress", "done"].includes(body.status)) {
      throw new AppError("Status must be todo, in_progress or done.");
    }
    if (!manage && !own) {
      throw new AppError("You can only update the status of a task assigned to you.", 403, "FORBIDDEN");
    }
    data.status = body.status;
  }

  if (body.assigneeId !== undefined) {
    if (!manage) {
      throw new AppError("Only a manager can assign tasks.", 403, "FORBIDDEN");
    }
    if (body.assigneeId === null) {
      data.assigneeId = null;
    } else {
      const assigneeId = requireId(body.assigneeId, "Assignee");
      const m = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: task.projectId, userId: assigneeId } },
      });
      if (!m) throw new AppError("That person is not on this project. Add them to the project first.");
      data.assigneeId = assigneeId;
    }
  }

  if (body.title !== undefined) {
    if (!manage) {
      throw new AppError("Only a manager can rename tasks.", 403, "FORBIDDEN");
    }
    data.title = requireText(body.title, "Task title");
  }

  if (Object.keys(data).length === 0) throw new AppError("Nothing to update.");

  res.json(await prisma.task.update({ where: { id }, data }));
});

router.delete("/:id", async (req, res) => {
  if (!canManageDelivery(req.user)) {
    throw new AppError("Only a manager can delete tasks.", 403, "FORBIDDEN");
  }
  const id = requireId(req.params.id, "Task id");
  const task = await prisma.task.findUnique({
    where: { id },
    include: { _count: { select: { timeEntries: true } } },
  });
  if (!task) throw new AppError("Task not found.", 404, "NOT_FOUND");
  if (task._count.timeEntries > 0) {
    throw new AppError("This task already has time logged, so it cannot be deleted.", 409, "HAS_TIME");
  }
  await prisma.task.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
