const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const dataDir = path.resolve(__dirname, "../data");
const dbPath = process.env.DB_PATH || path.join(dataDir, "app.db");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'User',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  };
}

function findUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email);
}

function createUser({ id, name, email, password, role = "User" }) {
  const passwordHash = bcrypt.hashSync(password, 12);
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).run(id, name, email, passwordHash, role);
  return sanitizeUser(findUserByEmail(email));
}

function verifyUser(email, password) {
  const user = findUserByEmail(email);
  if (!user) return null;
  const isValid = bcrypt.compareSync(password, user.password_hash);
  return isValid ? sanitizeUser(user) : null;
}

function createResetToken({ id, userId, token, expiresAt }) {
  db.prepare(
    `INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
     VALUES (?, ?, ?, ?)`
  ).run(id, userId, token, expiresAt);
}

function findValidResetToken(token) {
  return db
    .prepare(
      `SELECT prt.*, u.email, u.name
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token = ? AND prt.used_at IS NULL`
    )
    .get(token);
}

function resetPassword({ token, newPassword }) {
  const tokenRow = findValidResetToken(token);
  if (!tokenRow) return { ok: false, reason: "invalid" };
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };

  const passwordHash = bcrypt.hashSync(newPassword, 12);
  const tx = db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
      passwordHash,
      tokenRow.user_id
    );
    db.prepare("UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?").run(tokenRow.id);
  });
  tx();
  return { ok: true };
}

function listUsers() {
  return db.prepare("SELECT * FROM users ORDER BY created_at ASC").all().map(sanitizeUser);
}

module.exports = {
  createResetToken,
  createUser,
  db,
  findUserByEmail,
  findValidResetToken,
  listUsers,
  resetPassword,
  sanitizeUser,
  verifyUser,
};
