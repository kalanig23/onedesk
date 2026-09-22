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
    overrunOn: firstOverrunDate(project, timeEntries),
  };
}

function dayKey(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function firstOverrunDate(project, timeEntries) {
  const cap = Number(project.budgetDays) * HOURS_PER_DAY;
  if (!(cap > 0)) return null;
  const sorted = [...timeEntries].sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    return da - db || (a.id || 0) - (b.id || 0);
  });
  let hours = 0;
  for (const e of sorted) {
    hours += Number(e.hours) || 0;
    if (hours > cap) return dayKey(e.date);
  }
  return null;
}

function draftInvoice(timeEntries) {
  const byPerson = new Map();
  for (const e of timeEntries) {
    const name = e.user?.name || "Unknown";
    if (!byPerson.has(name)) {
      byPerson.set(name, { person: name, hours: 0, billableHours: 0, amount: 0 });
    }
    const line = byPerson.get(name);
    line.hours += Number(e.hours) || 0;
    if (e.billable) {
      line.billableHours += Number(e.hours) || 0;
      line.amount += (Number(e.hours) || 0) * (Number(e.rateAtEntry) || 0);
    }
  }
  const lines = [...byPerson.values()].map((l) => ({
    ...l,
    hours: round1(l.hours),
    billableHours: round1(l.billableHours),
    amount: Math.round(l.amount),
  }));
  return {
    lines,
    billableHours: round1(lines.reduce((s, l) => s + l.billableHours, 0)),
    amount: lines.reduce((s, l) => s + l.amount, 0),
  };
}

module.exports = { calculateBudget, firstOverrunDate, draftInvoice, HOURS_PER_DAY };