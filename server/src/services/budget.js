const HOURS_PER_DAY = 8; // assumption: 1 din = 8 ghante

// Sirf ek % se status nikalta hai
function statusFor(percent) {
  if (percent > 100) return "over";
  if (percent >= 90) return "warning";
  return "ok";
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// project: { budgetDays, budgetAmount }
// timeEntries: [{ hours, billable, rateAtEntry }]
function calculateBudget(project, timeEntries) {
  let totalHours = 0;
  let billableHours = 0;
  let burnedAmount = 0;

  for (const e of timeEntries) {
    totalHours += e.hours;
    if (e.billable) {
      billableHours += e.hours;
      // Us din ka freeze kiya hua rate, user ka abhi wala rate nahi
      burnedAmount += e.hours * e.rateAtEntry;
    }
  }
  burnedAmount = Math.round(burnedAmount);

  const burnedDays = totalHours / HOURS_PER_DAY;
  const percentDays = project.budgetDays > 0 ? (burnedDays / project.budgetDays) * 100 : 0;
  const percentAmount = project.budgetAmount > 0 ? (burnedAmount / project.budgetAmount) * 100 : 0;

  return {
    budgetDays: project.budgetDays,
    budgetAmount: project.budgetAmount,
    totalHours,
    billableHours,
    nonBillableHours: totalHours - billableHours,
    burnedDays,
    burnedAmount,
    remainingDays: project.budgetDays - burnedDays,
    remainingAmount: project.budgetAmount - burnedAmount,
    percentDays: round1(percentDays),
    percentAmount: round1(percentAmount),
    status: statusFor(Math.max(percentDays, percentAmount)),
  };
}

module.exports = { calculateBudget, HOURS_PER_DAY };