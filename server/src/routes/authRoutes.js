const crypto = require("crypto");
const express = require("express");
const AppError = require("../utils/appError");
const {
  createResetToken,
  createUser,
  findUserByEmail,
  listUsers,
  resetPassword,
  verifyUser,
  updateOnboardingStatus,
} = require("../db/database");

const router = express.Router();

function createSessionToken(userId) {
  return `session-${userId}-${crypto.randomBytes(12).toString("hex")}`;
}

router.post("/signup", express.json({ limit: "1mb" }), (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!name || !email || !password) {
      throw new AppError("Enter name, email, and password to create an account.", 400);
    }

    if (password.length < 6) {
      throw new AppError("Password must be at least 6 characters long.", 400);
    }

    const existing = findUserByEmail(email);
    if (existing) {
      throw new AppError("An account with this email already exists.", 409);
    }

    const user = createUser({
      id: crypto.randomUUID(),
      name,
      email,
      password,
      role: "User",
    });

    res.status(201).json({
      user,
      sessionToken: createSessionToken(user.id),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", express.json({ limit: "1mb" }), (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      throw new AppError("Enter both email and password to sign in.", 400);
    }

    const user = verifyUser(email, password);

    if (!user) {
      throw new AppError("Invalid email or password.", 401);
    }

    res.json({
      user,
      sessionToken: createSessionToken(user.id),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/request-password-reset", express.json({ limit: "1mb" }), (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email) {
      throw new AppError("Enter your email to request a password reset.", 400);
    }

    const user = findUserByEmail(email);
    if (!user) {
      return res.json({
        message: "If an account exists for that email, a reset code has been generated.",
      });
    }

    const resetToken = crypto.randomBytes(3).toString("hex").toUpperCase();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15).toISOString();

    createResetToken({
      id: crypto.randomUUID(),
      userId: user.id,
      token: resetToken,
      expiresAt,
    });

    res.json({
      message: "Reset code created. Enter the code and your new password within 15 minutes.",
      resetToken,
      expiresAt,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", express.json({ limit: "1mb" }), (req, res, next) => {
  try {
    const token = String(req.body?.token || "").trim().toUpperCase();
    const newPassword = String(req.body?.newPassword || "");

    if (!token || !newPassword) {
      throw new AppError("Enter the reset code and your new password.", 400);
    }

    if (newPassword.length < 6) {
      throw new AppError("New password must be at least 6 characters long.", 400);
    }

    const result = resetPassword({ token, newPassword });

    if (!result.ok) {
      throw new AppError(
        result.reason === "expired"
          ? "This reset code has expired. Request a new one."
          : "That reset code is invalid. Request a fresh code and try again.",
        400
      );
    }

    res.json({
      message: "Password updated successfully. You can sign in now.",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/users", (req, res, next) => {
  try {
    res.json({
      users: listUsers(),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/onboarding", express.json({ limit: "1mb" }), (req, res, next) => {
  try {
    const { userId, status } = req.body;
    if (!userId) {
      throw new AppError("User ID is required.", 400);
    }
    const user = updateOnboardingStatus(userId, status);
    res.json({
      message: "Onboarding status updated.",
      user,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
