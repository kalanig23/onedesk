const router = require("express").Router();
const bcrypt = require("bcryptjs");
const prisma = require("../db");
const { AppError } = require("../errors");
const { requireText, requireEmail, requireHourlyRate } = require("../validate");

const ROLES = ["sales", "manager", "member"];
const SALT_ROUNDS = 10;

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    hourlyRate: user.hourlyRate,
  };
}

function requirePassword(value) {
  const password = requireText(value, "Password");
  if (password.length < 6) {
    throw new AppError("Password must be at least 6 characters.");
  }
  return password;
}

async function allowAdminRole() {
  const admin = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });
  return !admin;
}

async function requireRole(value) {
  const role = requireText(value, "Role").toLowerCase();
  if (role === "admin") {
    if (!(await allowAdminRole())) {
      throw new AppError("An admin already exists. Ask them to add people, or register as sales, manager, or member.");
    }
    return "admin";
  }
  if (!ROLES.includes(role)) {
    throw new AppError("Role must be sales, manager, or member.");
  }
  return role;
}

router.get("/bootstrap", async (req, res) => {
  res.json({ allowAdmin: await allowAdminRole() });
});

router.post("/register", async (req, res) => {
  const body = req.body ?? {};
  const name = requireText(body.name, "Name");
  const email = requireEmail(body.email).toLowerCase();
  const password = requirePassword(body.password);
  const role = await requireRole(body.role);
  const hourlyRate = requireHourlyRate(body.hourlyRate);
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role, hourlyRate },
    });
    res.status(201).json(publicUser(user));
  } catch (e) {
    if (e.code === "P2002") {
      throw new AppError("An account with this email already exists.", 409, "DUPLICATE");
    }
    throw e;
  }
});

router.post("/login", async (req, res) => {
  const body = req.body ?? {};
  const email = requireEmail(body.email).toLowerCase();
  const password = requireText(body.password, "Password");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    throw new AppError("Email or password is incorrect.", 401, "BAD_CREDENTIALS");
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new AppError("Email or password is incorrect.", 401, "BAD_CREDENTIALS");
  }

  res.json(publicUser(user));
});

router.get("/me", async (req, res) => {
  if (!req.userId) {
    throw new AppError("Please log in first.", 401, "NOT_SIGNED_IN");
  }
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    throw new AppError("Please log in first.", 401, "NOT_SIGNED_IN");
  }
  res.json(publicUser(user));
});

module.exports = router;
