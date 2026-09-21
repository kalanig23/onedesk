const { AppError } = require("../errors");

const MAX_HOURS_PER_DAY = 24;

// Hours check: number ho, 0 se zyada, ek entry mein 24 se zyada nahi
function validateHours(value) {
  const n = typeof value === "string" && value.trim() === "" ? NaN : Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_HOURS_PER_DAY) {
    throw new AppError("Hours must be more than 0 and at most 24 for one entry.");
  }
  return Math.round(n * 100) / 100; // 2 decimal tak
}

// Date sirf "YYYY-MM-DD" format mein, aur bahut aage ki nahi
function parseDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError("Date must look like 2026-09-21.");
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new AppError("That date does not exist.");
  }
  // Ek din ki chhoot: India mein raat 3 baje UTC ki date peeche hoti hai
  const limit = new Date();
  limit.setUTCHours(0, 0, 0, 0);
  limit.setUTCDate(limit.getUTCDate() + 1);
  if (d > limit) throw new AppError("You cannot log time for a future date.");
  return d;
}

// Us din pehle se kitne ghante log hain, aur ab kitne jodne hain
function checkDailyTotal(alreadyLogged, hours) {
  if (alreadyLogged + hours > MAX_HOURS_PER_DAY + 1e-9) {
    throw new AppError(
      `You have already logged ${alreadyLogged}h on this day. Adding ${hours}h would go over ${MAX_HOURS_PER_DAY}h.`
    );
  }
}

module.exports = { validateHours, parseDay, checkDailyTotal, MAX_HOURS_PER_DAY };