const router = require("express").Router();
const prisma = require("../db");

// Fake login ke dropdown ke liye
router.get("/", async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { id: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });
  res.json(users);
});

module.exports = router;