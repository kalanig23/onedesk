const WEIGHT = {
  new: 0.1,
  qualified: 0.35,
  proposal_sent: 0.6,
  won: 1,
  lost: 0,
};

const QUIET_DAYS = 120;

function quarterRange(date = new Date()) {
  const q = Math.floor(date.getUTCMonth() / 3);
  const start = new Date(Date.UTC(date.getUTCFullYear(), q * 3, 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), q * 3 + 3, 1));
  return { start, end, label: `Q${q + 1} ${date.getUTCFullYear()}` };
}

function weightedValue(deal) {
  return Math.round(Number(deal.expectedValue || 0) * (WEIGHT[deal.stage] ?? 0));
}

function isQuiet(deal, now = new Date()) {
  if (deal.stage === "won" || deal.stage === "lost") return false;
  const at = new Date(deal.lastActivityAt || deal.updatedAt || deal.createdAt);
  return now.getTime() - at.getTime() >= QUIET_DAYS * 24 * 60 * 60 * 1000;
}

function proposalTotals(items) {
  const expectedDays = items.reduce((s, i) => s + Number(i.estimatedDays), 0);
  const expectedValue = Math.round(items.reduce((s, i) => s + Number(i.estimatedDays) * Number(i.dailyRate), 0));
  return { expectedDays, expectedValue };
}

function buildForecast(deals, now = new Date()) {
  const { start, end, label } = quarterRange(now);
  const inQuarter = deals.filter((d) => {
    const close = new Date(d.expectedCloseDate);
    return close >= start && close < end && d.stage !== "lost";
  });
  const likely = inQuarter.reduce((s, d) => s + weightedValue(d), 0);
  const unweighted = inQuarter.reduce((s, d) => s + d.expectedValue, 0);
  const quiet = deals.filter((d) => isQuiet(d, now));
  return {
    quarter: label,
    start,
    end,
    likely,
    unweighted,
    deals: inQuarter,
    quiet,
  };
}

module.exports = { WEIGHT, QUIET_DAYS, quarterRange, weightedValue, isQuiet, proposalTotals, buildForecast };
