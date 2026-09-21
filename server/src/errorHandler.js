const { AppError } = require("./errors");

function send(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
}

// Express ka aakhri safety net. Har error yahin aakar user-friendly message banta hai.
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) return send(res, err.status, err.code, err.message);

  if (err.type === "entity.parse.failed") {
    return send(res, 400, "BAD_JSON", "The data sent to the server was not valid JSON.");
  }
  if (err.code === "P2002") {
    return send(res, 409, "DUPLICATE", "That record already exists.");
  }
  if (err.code === "P2003") {
    return send(res, 400, "BAD_REFERENCE", "One of the linked records does not exist.");
  }

  if (err.code === "P2034") {
    return send(res, 409, "TRY_AGAIN", "Another change happened at the same moment. Please try again.");
  }

  // Developer ke liye poora error terminal mein, user ko sirf saaf message
  console.error(err);
  send(res, 500, "SERVER_ERROR", "Something went wrong on our side. Please try again.");
}

module.exports = { errorHandler };