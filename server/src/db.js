const { PrismaClient } = require("@prisma/client");

// Poore app mein ek hi database connection use hoga
module.exports = new PrismaClient();