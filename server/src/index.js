require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());          // frontend ko allow karo
app.use(express.json());  // JSON data padhne ke liye

// Ek test route: browser mein /api/health kholo to ye jawab aayega
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "OneDesk is running" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});