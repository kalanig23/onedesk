const { AppError } = require("./errors");

function requireLogin(req) {
  if (!req.user) throw new AppError("Please log in first.", 401, "NOT_SIGNED_IN");
}

function requireRole(req, ...roles) {
  requireLogin(req);
  if (req.user.role === "admin") return;
  if (!roles.includes(req.user.role)) {
    const message = req.user.role === "sales"
      ? "This is a delivery screen. Sales uses Accounts, Deals and Forecast."
      : "This is a sales screen. Delivery uses Projects and Log time.";
    throw new AppError(message, 403, "FORBIDDEN");
  }
}

function salesOnly(req, res, next) {
  try {
    requireRole(req, "sales", "admin");
    next();
  } catch (err) {
    next(err);
  }
}

function deliveryOnly(req, res, next) {
  try {
    requireRole(req, "manager", "member", "admin");
    next();
  } catch (err) {
    next(err);
  }
}

function adminOnly(req, res, next) {
  try {
    requireLogin(req);
    if (req.user.role !== "admin") {
      throw new AppError("Only an admin can open this.", 403, "FORBIDDEN");
    }
    next();
  } catch (err) {
    next(err);
  }
}

function canManageDelivery(user) {
  return Boolean(user && (user.role === "manager" || user.role === "admin"));
}

function managerOnly(req, res, next) {
  try {
    requireRole(req, "manager", "admin");
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  requireLogin, requireRole, salesOnly, deliveryOnly, adminOnly,
  canManageDelivery, managerOnly,
};
