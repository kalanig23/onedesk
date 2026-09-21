const { AppError } = require("../errors");

// Har stage se kahan-kahan ja sakte hain
const ALLOWED = {
  new: ["qualified", "lost"],
  qualified: ["proposal_sent", "lost"],
  proposal_sent: ["won", "lost"],
  won: [],
  lost: [],
};

const LABELS = {
  new: "New",
  qualified: "Qualified",
  proposal_sent: "Proposal Sent",
  won: "Won",
  lost: "Lost",
};

// Rule todne par error phenkta hai. Sab theek ho to kuch nahi karta.
function validateStageChange(from, to, lostReason) {
  if (!Object.hasOwn(ALLOWED, from) || !Object.hasOwn(ALLOWED, to)) {
    throw new AppError("That stage does not exist.");
  }
  if (from === to) {
    throw new AppError(`The deal is already in ${LABELS[from]}.`);
  }
  if (ALLOWED[from].length === 0) {
    throw new AppError(`This deal is already ${LABELS[from]} and cannot be moved again.`);
  }
  if (!ALLOWED[from].includes(to)) {
    const next = ALLOWED[from].map((s) => LABELS[s]).join(" or ");
    throw new AppError(`A deal in ${LABELS[from]} can only move to ${next}.`);
  }
  if (to === "lost" && (!lostReason || !lostReason.trim())) {
    throw new AppError("Please tell us why the deal was lost.");
  }
}

module.exports = { validateStageChange, ALLOWED, LABELS };