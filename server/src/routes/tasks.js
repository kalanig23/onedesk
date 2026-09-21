const router = require("express").Router();
const prisma = require("../db");
const { AppError } = require("../errors");
const { requireId } = require("../validate");

router.patch("/:id", async (req, res) => {
  const id = requireId(req.params.id, "Task id");
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw new AppError("Task not found.", 404, "NOT_FOUND");

  const data = {};
  const body = req.body ?? {};

  if (body.status !== undefined) {
    if (!["todo", "in_progress", "done"].includes(body.status)) {
      throw new AppError("Status must be todo, in_progress or done.");
    }
    data.status = body.status;
  }

  if (body.assigneeId !== undefined) {
    if (body.assigneeId === null) {
      data.assigneeId = null; // assign hata do
    } else {
      const assigneeId = requireId(body.assigneeId, "Assignee");
      const m = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: task.projectId, userId: assigneeId } },
      });
      if (!m) throw new AppError("That person is not on this project. Add them to the project first.");
      data.assigneeId = assigneeId;
    }
  }

  res.json(await prisma.task.update({ where: { id }, data }));
});

module.exports = router;