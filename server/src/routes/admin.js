const router = require("express").Router();
const prisma = require("../db");
const { AppError } = require("../errors");
const { adminOnly } = require("../authz");
const { requireId, requireHourlyRate } = require("../validate");

router.use(adminOnly);

router.get("/people", async (req, res) => {
  const people = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      hourlyRate: true,
      ownedDeals: {
        orderBy: { expectedCloseDate: "asc" },
        select: {
          id: true,
          title: true,
          stage: true,
          expectedValue: true,
          account: { select: { id: true, name: true } },
        },
      },
      managedProjects: {
        orderBy: { id: "asc" },
        select: { id: true, name: true, status: true, account: { select: { name: true } } },
      },
      memberships: {
        select: { project: { select: { id: true, name: true, status: true } } },
      },
      timeEntries: {
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: 8,
        select: {
          id: true,
          date: true,
          hours: true,
          billable: true,
          task: { select: { title: true, project: { select: { name: true } } } },
        },
      },
      _count: {
        select: {
          ownedDeals: true,
          managedProjects: true,
          memberships: true,
          timeEntries: true,
        },
      },
    },
  });

  const roles = {};
  for (const p of people) {
    roles[p.role] = (roles[p.role] || 0) + 1;
  }

  res.json({ roles, people });
});

router.patch("/people/:id", async (req, res) => {
  const id = requireId(req.params.id, "Person");
  const hourlyRate = requireHourlyRate(req.body?.hourlyRate);
  const found = await prisma.user.findUnique({ where: { id } });
  if (!found) throw new AppError("That person does not exist.", 404, "NOT_FOUND");
  const user = await prisma.user.update({
    where: { id },
    data: { hourlyRate },
    select: { id: true, name: true, email: true, role: true, hourlyRate: true },
  });
  res.json(user);
});

module.exports = router;
