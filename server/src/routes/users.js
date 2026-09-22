const router = require("express").Router();
const prisma = require("../db");
const { deliveryOnly } = require("../authz");

router.use(deliveryOnly);

router.get("/", async (req, res) => {
  const users = await prisma.user.findMany({
    where: { role: { in: ["manager", "member"] } },
    orderBy: { id: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });
  res.json(users);
});

module.exports = router;
