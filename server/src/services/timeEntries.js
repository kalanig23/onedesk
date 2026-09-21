const prisma = require("../db");
const { AppError } = require("../errors");
const { requireId } = require("../validate");
const { validateHours, parseDay, checkDailyTotal } = require("./timeRules");

async function logTime(userId, input = {}) {
  if (!userId) {
    throw new AppError("Choose who you are from the user menu first.", 401, "NOT_SIGNED_IN");
  }

  // 1. Pehle input ki jaanch (database ki zaroorat nahi)
  const taskId = requireId(input.taskId, "Task");
  const hours = validateHours(input.hours);
  const date = parseDay(input.date);
  if (input.billable !== undefined && typeof input.billable !== "boolean") {
    throw new AppError("Billable must be true or false.");
  }
  const billable = input.billable ?? true;
  const note = typeof input.note === "string" && input.note.trim() ? input.note.trim().slice(0, 300) : null;

  // 2. Phir database ke rules. Serializable = do log ek saath log karein to ek ko "try again" milega
  return prisma.$transaction(
    async (tx) => {
      const task = await tx.task.findUnique({ where: { id: taskId }, include: { project: true } });
      if (!task) throw new AppError("Task not found.", 404, "NOT_FOUND");

      if (task.project.status === "closed") {
        throw new AppError("This project is closed, so time can no longer be logged to it.", 409, "PROJECT_CLOSED");
      }

      const member = await tx.projectMember.findUnique({
        where: { projectId_userId: { projectId: task.projectId, userId } },
      });
      if (!member) {
        throw new AppError("You are not on this project, so you cannot log time to it.", 403, "NOT_A_MEMBER");
      }

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new AppError("That user does not exist.", 401, "NOT_SIGNED_IN");

      const sum = await tx.timeEntry.aggregate({ _sum: { hours: true }, where: { userId, date } });
      checkDailyTotal(sum._sum.hours ?? 0, hours);

      return tx.timeEntry.create({
        data: {
          taskId, userId, date, hours, billable, note,
          rateAtEntry: user.hourlyRate, // aaj ka rate freeze
        },
      });
    },
    { isolationLevel: "Serializable" }
  );
}

module.exports = { logTime };