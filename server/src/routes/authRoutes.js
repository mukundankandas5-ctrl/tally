const express = require("express");
const fs = require("fs");
const path = require("path");
const AppError = require("../utils/appError");

const router = express.Router();
const usersFile = path.resolve(__dirname, "../data/users.json");

function readUsers() {
  const raw = fs.readFileSync(usersFile, "utf8");
  const payload = JSON.parse(raw);
  return Array.isArray(payload.users) ? payload.users : [];
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

router.post("/login", express.json({ limit: "1mb" }), (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      throw new AppError("Enter both email and password to sign in.", 400);
    }

    const user = readUsers().find(
      (item) => item.email.toLowerCase() === email && item.password === password
    );

    if (!user) {
      throw new AppError("Invalid email or password.", 401);
    }

    res.json({
      user: sanitizeUser(user),
      sessionToken: `demo-session-${user.id}`,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/users", (req, res, next) => {
  try {
    res.json({
      users: readUsers().map(sanitizeUser),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
