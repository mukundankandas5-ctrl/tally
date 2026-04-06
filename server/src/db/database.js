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

  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bank_name TEXT NOT NULL DEFAULT 'Kotak Mahindra Bank',
    tally_company_name TEXT NOT NULL DEFAULT '',
    pending_entries INTEGER NOT NULL DEFAULT 0,
    accuracy_score REAL NOT NULL DEFAULT 97.0,
    last_activity TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS document_requests (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    title TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'Email',
    status TEXT NOT NULL DEFAULT 'Pending',
    due_date TEXT,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );
`);

const seedClients = [
  ["aurora", "Aurora Traders LLP", "Kotak Mahindra Bank", "Aurora Traders LLP", 18, 98.4, "2026-04-05T10:15:00.000Z"],
  ["bluewave", "Bluewave Retail Pvt Ltd", "HDFC Bank", "Bluewave Retail Pvt Ltd", 6, 96.9, "2026-04-05T09:10:00.000Z"],
  ["greenleaf", "Greenleaf Foods", "ICICI Bank", "Greenleaf Foods", 11, 97.6, "2026-04-04T17:45:00.000Z"],
];

const seedDocumentRequests = [
  ["doc-aurora-q4-bank", "aurora", "Aurora Traders LLP", "Q4 bank statement and bank charges advice", "WhatsApp", "Pending", "2026-04-08", "Follow up for missing March statement PDF."],
  ["doc-bluewave-gst", "bluewave", "Bluewave Retail Pvt Ltd", "March purchase register for GST reconciliation", "Email", "In Review", "2026-04-07", "Client shared draft workbook, awaiting final copy."],
];

function seedIfEmpty() {
  const clientCount = db.prepare("SELECT COUNT(*) AS count FROM clients").get()?.count || 0;
  if (!clientCount) {
    const insertClient = db.prepare(
      `INSERT INTO clients
       (id, name, bank_name, tally_company_name, pending_entries, accuracy_score, last_activity, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    );
    seedClients.forEach((client) => insertClient.run(...client));
  }

  const requestCount = db.prepare("SELECT COUNT(*) AS count FROM document_requests").get()?.count || 0;
  if (!requestCount) {
    const insertRequest = db.prepare(
      `INSERT INTO document_requests
       (id, client_id, client_name, title, channel, status, due_date, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    );
    seedDocumentRequests.forEach((request) => insertRequest.run(...request));
  }
}

seedIfEmpty();

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

function sanitizeClient(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    bankName: row.bank_name,
    tallyCompanyName: row.tally_company_name,
    pendingEntries: row.pending_entries,
    accuracyScore: row.accuracy_score,
    lastActivity: row.last_activity,
    createdAt: row.created_at,
  };
}

function listClients() {
  return db.prepare("SELECT * FROM clients ORDER BY updated_at DESC, name ASC").all().map(sanitizeClient);
}

function createClient({ id, name, bankName, tallyCompanyName }) {
  db.prepare(
    `INSERT INTO clients
     (id, name, bank_name, tally_company_name, pending_entries, accuracy_score, last_activity, updated_at)
     VALUES (?, ?, ?, ?, 0, 97.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).run(id, name, bankName || "Kotak Mahindra Bank", tallyCompanyName || name);
  return sanitizeClient(db.prepare("SELECT * FROM clients WHERE id = ?").get(id));
}

function touchClientActivity(clientId, pendingEntries, accuracyScore) {
  if (!clientId) return;
  db.prepare(
    `UPDATE clients
     SET pending_entries = COALESCE(?, pending_entries),
         accuracy_score = COALESCE(?, accuracy_score),
         last_activity = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    Number.isFinite(pendingEntries) ? pendingEntries : null,
    Number.isFinite(accuracyScore) ? accuracyScore : null,
    clientId
  );
}

function sanitizeDocumentRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    title: row.title,
    channel: row.channel,
    status: row.status,
    dueDate: row.due_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function listDocumentRequests() {
  return db
    .prepare(
      "SELECT * FROM document_requests ORDER BY CASE status WHEN 'Pending' THEN 0 WHEN 'In Review' THEN 1 ELSE 2 END, due_date ASC, updated_at DESC"
    )
    .all()
    .map(sanitizeDocumentRequest);
}

function createDocumentRequest({ id, clientId, clientName, title, channel, dueDate, notes }) {
  db.prepare(
    `INSERT INTO document_requests
     (id, client_id, client_name, title, channel, status, due_date, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?, CURRENT_TIMESTAMP)`
  ).run(id, clientId, clientName, title, channel || "Email", dueDate || "", notes || "");
  return sanitizeDocumentRequest(db.prepare("SELECT * FROM document_requests WHERE id = ?").get(id));
}

function updateDocumentRequestStatus(id, status) {
  db.prepare("UPDATE document_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, id);
}

module.exports = {
  createClient,
  createDocumentRequest,
  createResetToken,
  createUser,
  db,
  findUserByEmail,
  findValidResetToken,
  listClients,
  listDocumentRequests,
  listUsers,
  resetPassword,
  sanitizeUser,
  touchClientActivity,
  updateDocumentRequestStatus,
  verifyUser,
};
