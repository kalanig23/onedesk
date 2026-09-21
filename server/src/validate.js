const { AppError } = require("./errors");

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(`${label} is required.`);
  }
  return value.trim();
}

function requireEmail(value, label = "Email") {
  const v = requireText(value, label);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    throw new AppError(`${label} does not look like a valid email address.`);
  }
  return v;
}

function requirePositiveNumber(value, label, max = 1_000_000_000) {
  const n = typeof value === "string" && value.trim() === "" ? NaN : Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new AppError(`${label} must be a number greater than 0.`);
  }
  if (n > max) throw new AppError(`${label} is too large.`);
  return n;
}

function requirePositiveInt(value, label, max) {
  const n = requirePositiveNumber(value, label, max);
  if (!Number.isInteger(n)) throw new AppError(`${label} must be a whole number.`);
  return n;
}

function requireDate(value, label) {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) {
    throw new AppError(`${label} must be a valid date.`);
  }
  return d;
}

function requireId(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new AppError(`${label} is invalid.`);
  return n;
}

module.exports = { requireText, requireEmail, requirePositiveNumber, requirePositiveInt, requireDate, requireId };