// Ek custom error, jisme HTTP status bhi hota hai.
// Baad mein API isse dekhkar user ko saaf message dikhayegi.
class AppError extends Error {
  constructor(message, status = 400, code = "VALIDATION_ERROR") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

module.exports = { AppError };