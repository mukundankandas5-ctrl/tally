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

  CREATE TABLE IF NOT EXISTS mapping_rules (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    condition_text TEXT NOT NULL,
    ledger TEXT NOT NULL,
    voucher_type TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pending_push_queue (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sync_history (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    tally_company TEXT,
    type TEXT NOT NULL,
    entries_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Success',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

try {
  db.exec("ALTER TABLE users ADD COLUMN onboarding_complete INTEGER NOT NULL DEFAULT 0;");
} catch (e) {
  // Column already exists
}

// One-time cleanup: purge previously seeded demo data from deployed databases
const seedClientIds = ["aurora", "bluewave", "greenleaf"];
const seedDocRequestIds = ["doc-aurora-q4-bank", "doc-bluewave-gst"];

db.prepare(
  `DELETE FROM document_requests WHERE id IN (${seedDocRequestIds.map(() => "?").join(",")})`
).run(...seedDocRequestIds);

db.prepare(
  `DELETE FROM clients WHERE id IN (${seedClientIds.map(() => "?").join(",")})`
).run(...seedClientIds);


function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    onboardingComplete: Boolean(row.onboarding_complete),
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

function updateOnboardingStatus(userId, status) {
  db.prepare("UPDATE users SET onboarding_complete = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
    status ? 1 : 0,
    userId
  );
  return sanitizeUser(db.prepare("SELECT * FROM users WHERE id = ?").get(userId));
}

function logActivity(message, type = 'info', clientId = null) {
  const id = `act-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  db.prepare(
    "INSERT INTO activity_logs (id, client_id, message, type) VALUES (?, ?, ?, ?)"
  ).run(id, clientId, message, type);
}

function getRecentActivities(limit = 10) {
  return db.prepare("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ?").all(limit).map(row => ({
    id: row.id,
    clientId: row.client_id,
    message: row.message,
    type: row.type,
    createdAt: row.created_at
  }));
}

function recordSync(type, entriesCount, status = 'Success', tallyCompany = '', clientId = null) {
  const id = `sync-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  db.prepare(
    "INSERT INTO sync_history (id, client_id, tally_company, type, entries_count, status) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, clientId, tallyCompany, type, entriesCount, status);
  
  if (status === 'Success') {
    logActivity(`Pushed ${entriesCount} ${type} entries to Tally`, 'success', clientId);
  }
}

function getSyncHistory(limit = 50) {
  return db.prepare("SELECT * FROM sync_history ORDER BY created_at DESC LIMIT ?").all(limit).map(row => ({
    id: row.id,
    clientId: row.client_id,
    tallyCompany: row.tally_company,
    type: row.type,
    entriesCount: row.entries_count,
    status: row.status,
    createdAt: row.created_at
  }));
}

function queuePendingPush({ clientId, type, payload }) {
  const id = `push-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  db.prepare(
    "INSERT INTO pending_push_queue (id, client_id, type, payload) VALUES (?, ?, ?, ?)"
  ).run(id, clientId || null, type, JSON.stringify(payload));
  return id;
}

function getPendingPushes(clientId) {
  return db.prepare("SELECT * FROM pending_push_queue WHERE status = 'pending' AND (client_id = ? OR ? IS NULL) ORDER BY created_at ASC").all(clientId, clientId).map(row => ({
    id: row.id,
    clientId: row.client_id,
    type: row.type,
    payload: JSON.parse(row.payload),
    createdAt: row.created_at
  }));
}

function updatePendingPushStatus(id, status) {
  db.prepare("UPDATE pending_push_queue SET status = ? WHERE id = ?").run(status, id);
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
  updateOnboardingStatus,
  logActivity,
  getRecentActivities,
  recordSync,
  getSyncHistory,
  queuePendingPush,
  getPendingPushes,
  updatePendingPushStatus,
};
