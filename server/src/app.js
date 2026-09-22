require("dotenv").config();
const express = require("express");
const cors = require("cors");
const prisma = require("./db");
const { errorHandler } = require("./errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

app.use(async (req, res, next) => {
  try {
    const raw = req.header("x-user-id");
    const n = Number(raw);
    req.userId = raw && Number.isInteger(n) && n > 0 ? n : null;
    req.user = null;
    if (req.userId) {
      req.user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, name: true, email: true, role: true },
      });
    }
    next();
  } catch (err) {
    next(err);
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "OneDesk is running" });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/users", require("./routes/users"));
app.use("/api/accounts", require("./routes/accounts"));
app.use("/api/deals", require("./routes/deals"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/time-entries", require("./routes/timeEntries"));

app.use("/api", (req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "That address does not exist." } });
});

app.use(errorHandler);

module.exports = app;
