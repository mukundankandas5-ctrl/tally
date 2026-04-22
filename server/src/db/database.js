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
    condition_text TEXT,
    pattern TEXT,
    upi_vpa TEXT,
    category TEXT,
    ledger TEXT NOT NULL,
    voucher_type TEXT NOT NULL,
    source TEXT DEFAULT 'user_correction',
    confidence_score REAL DEFAULT 1.0,
    use_count INTEGER DEFAULT 1,
    active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    narration TEXT NOT NULL DEFAULT '',
    normalised_narration TEXT NOT NULL DEFAULT '',
    upi_vpa TEXT,
    amount REAL NOT NULL DEFAULT 0,
    debit REAL NOT NULL DEFAULT 0,
    credit REAL NOT NULL DEFAULT 0,
    txn_type TEXT NOT NULL DEFAULT 'DEBIT',
    date TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Miscellaneous Expense',
    ledger TEXT NOT NULL DEFAULT 'Miscellaneous',
    voucher_type TEXT NOT NULL DEFAULT 'Payment',
    confidence REAL NOT NULL DEFAULT 0,
    confidence_label TEXT NOT NULL DEFAULT 'low',
    reasoning TEXT NOT NULL DEFAULT '',
    flags TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'flagged',
    reviewed_at TEXT,
    reviewed_by TEXT,
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
  CREATE TABLE IF NOT EXISTS tally_ledgers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    company_name TEXT NOT NULL,
    name TEXT NOT NULL,
    parent TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, company_name, name)
  );

  CREATE INDEX IF NOT EXISTS idx_tally_ledgers_user_company ON tally_ledgers(user_id, company_name);

  CREATE TABLE IF NOT EXISTS bank_statement_analyses (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    file_name TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    statement_data TEXT NOT NULL,
    summary TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS statement_change_history (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL,
    change_type TEXT NOT NULL,
    previous_state TEXT,
    new_state TEXT,
    change_summary TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (analysis_id) REFERENCES bank_statement_analyses(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_bank_statement_analyses_client ON bank_statement_analyses(client_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_statement_change_history_analysis ON statement_change_history(analysis_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS duplicate_transactions (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL,
    transaction_id_1 TEXT NOT NULL,
    transaction_id_2 TEXT NOT NULL,
    match_score REAL NOT NULL,
    match_reason TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (analysis_id) REFERENCES bank_statement_analyses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS account_mappings (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    debit_account TEXT NOT NULL,
    credit_account TEXT NOT NULL,
    frequency INTEGER DEFAULT 1,
    confidence_score REAL DEFAULT 0.8,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id, debit_account, credit_account)
  );

  CREATE TABLE IF NOT EXISTS export_validations (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL,
    validation_type TEXT NOT NULL,
    status TEXT NOT NULL,
    issue_count INTEGER DEFAULT 0,
    issues TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (analysis_id) REFERENCES bank_statement_analyses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS processing_analytics (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    analysis_id TEXT,
    metric_type TEXT NOT NULL,
    metric_value REAL,
    metric_label TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tally_reconciliation (
    id TEXT PRIMARY KEY,
    analysis_id TEXT,
    client_id TEXT,
    push_date TEXT NOT NULL,
    xml_hash TEXT,
    expected_count INTEGER,
    received_count INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    matched_entries INTEGER DEFAULT 0,
    mismatches TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_assignments (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    assigned_by TEXT,
    status TEXT DEFAULT 'assigned',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (analysis_id) REFERENCES bank_statement_analyses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    analysis_id TEXT,
    user_id TEXT,
    action TEXT NOT NULL,
    changes TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_duplicate_transactions_analysis ON duplicate_transactions(analysis_id);
  CREATE INDEX IF NOT EXISTS idx_account_mappings_client ON account_mappings(client_id, is_active);
  CREATE INDEX IF NOT EXISTS idx_export_validations_analysis ON export_validations(analysis_id);
  CREATE INDEX IF NOT EXISTS idx_processing_analytics_client ON processing_analytics(client_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_tally_reconciliation_analysis ON tally_reconciliation(analysis_id);
  CREATE INDEX IF NOT EXISTS idx_user_assignments_analysis ON user_assignments(analysis_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_analysis ON audit_logs(analysis_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS tds_entries (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    fiscal_year INTEGER NOT NULL,
    payee_id TEXT,
    payee_name TEXT NOT NULL,
    tds_section TEXT NOT NULL,
    amount REAL NOT NULL,
    tds_rate REAL NOT NULL,
    tds_amount REAL NOT NULL,
    entry_date TEXT NOT NULL,
    remitted INTEGER DEFAULT 0,
    remitted_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tds_certificates (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    fiscal_year INTEGER NOT NULL,
    form_number TEXT NOT NULL,
    payee_id TEXT,
    payee_name TEXT NOT NULL,
    total_amount REAL,
    total_deducted REAL,
    certificate_date TEXT,
    issued_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS gst_reconciliations (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    fiscal_year INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    tax_amount REAL,
    input_credit REAL,
    reconciliation_date TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS compliance_checklists (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    fiscal_year INTEGER NOT NULL,
    category TEXT NOT NULL,
    task_id TEXT NOT NULL,
    task_name TEXT NOT NULL,
    priority TEXT NOT NULL,
    due_date TEXT,
    completed INTEGER DEFAULT 0,
    completed_date TEXT,
    assigned_to TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, fiscal_year, task_id)
  );

  CREATE INDEX IF NOT EXISTS idx_tds_entries_company_fy ON tds_entries(company_id, fiscal_year);
  CREATE INDEX IF NOT EXISTS idx_tds_entries_date ON tds_entries(entry_date);
  CREATE INDEX IF NOT EXISTS idx_tds_certificates_company_fy ON tds_certificates(company_id, fiscal_year);
  CREATE INDEX IF NOT EXISTS idx_gst_reconciliations_company_fy ON gst_reconciliations(company_id, fiscal_year);
  CREATE INDEX IF NOT EXISTS idx_compliance_checklists_company_fy ON compliance_checklists(company_id, fiscal_year);
  CREATE INDEX IF NOT EXISTS idx_compliance_checklists_category ON compliance_checklists(category);
`);

try {
  db.exec("ALTER TABLE users ADD COLUMN onboarding_complete INTEGER NOT NULL DEFAULT 0;");
} catch (e) {
  // Column already exists
}

function ensureColumn(tableName, columnDefinition) {
  const columnName = columnDefinition.split(" ")[0];
  try {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition};`);
  } catch (error) {
    if (!String(error.message || "").includes(`duplicate column name: ${columnName}`)) {
      throw error;
    }
  }
}

ensureColumn("mapping_rules", "pattern TEXT");
ensureColumn("mapping_rules", "upi_vpa TEXT");
ensureColumn("mapping_rules", "category TEXT");
ensureColumn("mapping_rules", "source TEXT DEFAULT 'user_correction'");
ensureColumn("mapping_rules", "confidence_score REAL DEFAULT 1.0");
ensureColumn("mapping_rules", "use_count INTEGER DEFAULT 1");
ensureColumn("mapping_rules", "active INTEGER DEFAULT 1");
ensureColumn("mapping_rules", "updated_at TEXT DEFAULT CURRENT_TIMESTAMP");
ensureColumn("mapping_rules", "condition_text TEXT");

db.exec("UPDATE mapping_rules SET pattern = COALESCE(NULLIF(pattern, ''), condition_text) WHERE pattern IS NULL OR pattern = '';");
db.exec("UPDATE mapping_rules SET category = COALESCE(NULLIF(category, ''), ledger) WHERE category IS NULL OR category = '';");
db.exec(
  "UPDATE mapping_rules SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at, CURRENT_TIMESTAMP) WHERE updated_at IS NULL OR updated_at = '';"
);

db.exec("CREATE INDEX IF NOT EXISTS idx_mapping_rules_client ON mapping_rules(client_id, active);");
db.exec("CREATE INDEX IF NOT EXISTS idx_transactions_client_date ON transactions(client_id, date);");

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

function confidenceToLabel(value) {
  const numeric = Number(value || 0);
  if (numeric >= 0.85) return "high";
  if (numeric >= 0.6) return "medium";
  return "low";
}

function saveTransactions(records = []) {
  const rows = Array.isArray(records) ? records : [];
  if (!rows.length) return;

  const statement = db.prepare(
    `INSERT INTO transactions (
      id, client_id, narration, normalised_narration, upi_vpa, amount, debit, credit, txn_type, date,
      category, ledger, voucher_type, confidence, confidence_label, reasoning, flags, status, created_at
    ) VALUES (
      @id, @client_id, @narration, @normalised_narration, @upi_vpa, @amount, @debit, @credit, @txn_type, @date,
      @category, @ledger, @voucher_type, @confidence, @confidence_label, @reasoning, @flags, @status, @created_at
    )`
  );

  const insertMany = db.transaction((items) => {
    for (const row of items) {
      statement.run({
        id: row.id,
        client_id: row.client_id || null,
        narration: row.narration || "",
        normalised_narration: row.normalised_narration || "",
        upi_vpa: row.upi_vpa || null,
        amount: Number(row.amount || 0),
        debit: Number(row.debit || 0),
        credit: Number(row.credit || 0),
        txn_type: row.txn_type || "DEBIT",
        date: row.date || "",
        category: row.category || "Miscellaneous Expense",
        ledger: row.ledger || "Miscellaneous",
        voucher_type: row.voucher_type || "Payment",
        confidence: Number(row.confidence || 0),
        confidence_label: row.confidence_label || confidenceToLabel(row.confidence),
        reasoning: row.reasoning || "",
        flags: row.flags || "[]",
        status: row.status || "flagged",
        created_at: row.created_at || new Date().toISOString(),
      });
    }
  });

  insertMany(rows);
}

function updateTransactionClassification({ id, category, ledger, voucherType, reviewedBy }) {
  db.prepare(
    `UPDATE transactions
     SET category = ?,
         ledger = ?,
         voucher_type = ?,
         status = 'confirmed',
         reviewed_at = CURRENT_TIMESTAMP,
         reviewed_by = ?
     WHERE id = ?`
  ).run(category, ledger, voucherType, reviewedBy || null, id);
}

function getClientMappingRules(clientId, limit = 20) {
  if (!clientId) return [];
  return db
    .prepare(
      `SELECT *
       FROM mapping_rules
       WHERE client_id = ? AND COALESCE(active, 1) = 1
       ORDER BY COALESCE(confidence_score, 0) DESC, COALESCE(use_count, 0) DESC, updated_at DESC
       LIMIT ?`
    )
    .all(clientId, limit);
}

function upsertMappingRule({
  clientId,
  pattern,
  upiVpa,
  category,
  ledger,
  voucherType,
  source = "user_correction",
  confidenceScore = 1.0,
}) {
  if (!clientId || !pattern) return;

  const existing = db
    .prepare(
      `SELECT *
       FROM mapping_rules
       WHERE client_id = ? AND pattern = ?
       ORDER BY updated_at DESC
       LIMIT 1`
    )
    .get(clientId, pattern);

  if (existing) {
    db.prepare(
      `UPDATE mapping_rules
       SET upi_vpa = ?,
           category = ?,
           ledger = ?,
           voucher_type = ?,
           source = ?,
           confidence_score = ?,
           use_count = COALESCE(use_count, 0) + 1,
           active = 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(
      upiVpa || existing.upi_vpa || null,
      category,
      ledger,
      voucherType,
      source,
      Number(confidenceScore || existing.confidence_score || 1),
      existing.id
    );
    return existing.id;
  }

  const id = `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  db.prepare(
    `INSERT INTO mapping_rules (
      id, client_id, condition_text, pattern, upi_vpa, category, ledger, voucher_type,
      source, confidence_score, use_count, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).run(id, clientId, pattern, pattern, upiVpa || null, category, ledger, voucherType, source, Number(confidenceScore || 1));

  return id;
}

function saveTallyLedgers(userId, companyName, ledgers = []) {
  if (!userId || !companyName) return;

  const deleteStmt = db.prepare("DELETE FROM tally_ledgers WHERE user_id = ? AND company_name = ?");
  const insertStmt = db.prepare(
    `INSERT INTO tally_ledgers (id, user_id, company_name, name, parent, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  );

  const tx = db.transaction((items) => {
    deleteStmt.run(userId, companyName);
    for (const item of items) {
      const id = `ldg-${userId}-${companyName}-${item.name}-${Math.random().toString(16).slice(2)}`.replace(/[^a-z0-9-]/gi, "");
      insertStmt.run(id.slice(0, 100), userId, companyName, item.name, item.parent || "");
    }
  });

  tx(ledgers);
}

function getTallyLedgers(userId, companyName) {
  if (!userId || !companyName) return [];
  return db
    .prepare("SELECT name, parent FROM tally_ledgers WHERE user_id = ? AND company_name = ? ORDER BY name ASC")
    .all(userId, companyName);
}

function saveBankStatementAnalysis({ id, clientId, fileName, originalFileName, statementData, summary }) {
  const existing = db.prepare("SELECT * FROM bank_statement_analyses WHERE id = ?").get(id);
  
  if (existing) {
    db.prepare(
      `UPDATE bank_statement_analyses 
       SET statement_data = ?, summary = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    ).run(JSON.stringify(statementData), JSON.stringify(summary), id);
  } else {
    db.prepare(
      `INSERT INTO bank_statement_analyses (id, client_id, file_name, original_file_name, statement_data, summary, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).run(id, clientId || null, fileName, originalFileName, JSON.stringify(statementData), JSON.stringify(summary));
  }
  return id;
}

function getBankStatementAnalysis(id) {
  const row = db.prepare("SELECT * FROM bank_statement_analyses WHERE id = ?").get(id);
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    fileName: row.file_name,
    originalFileName: row.original_file_name,
    statementData: JSON.parse(row.statement_data || "{}"),
    summary: JSON.parse(row.summary || "{}"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function listBankStatementAnalyses(clientId, limit = 50) {
  const rows = db.prepare(
    `SELECT id, file_name, original_file_name, summary, created_at, updated_at 
     FROM bank_statement_analyses 
     WHERE client_id = ? OR ? IS NULL
     ORDER BY created_at DESC 
     LIMIT ?`
  ).all(clientId, clientId ? null : clientId, limit);
  
  return rows.map(row => ({
    id: row.id,
    fileName: row.file_name,
    originalFileName: row.original_file_name,
    summary: JSON.parse(row.summary || "{}"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

function saveBankStatementChange({ id, analysisId, changeType, previousState, newState, changeSummary }) {
  db.prepare(
    `INSERT INTO statement_change_history (id, analysis_id, change_type, previous_state, new_state, change_summary)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    analysisId,
    changeType,
    previousState ? JSON.stringify(previousState) : null,
    newState ? JSON.stringify(newState) : null,
    changeSummary || ""
  );
}

function getStatementChangeHistory(analysisId, limit = 100) {
  const rows = db.prepare(
    `SELECT * FROM statement_change_history 
     WHERE analysis_id = ? 
     ORDER BY created_at DESC 
     LIMIT ?`
  ).all(analysisId, limit);
  
  return rows.map(row => ({
    id: row.id,
    analysisId: row.analysis_id,
    changeType: row.change_type,
    previousState: row.previous_state ? JSON.parse(row.previous_state) : null,
    newState: row.new_state ? JSON.parse(row.new_state) : null,
    changeSummary: row.change_summary,
    createdAt: row.created_at,
  }));
}

function deleteBankStatementAnalysis(id) {
  db.prepare("DELETE FROM bank_statement_analyses WHERE id = ?").run(id);
}

// Duplicate Transaction Functions
function saveDuplicateTransactions(analysisId, duplicates = []) {
  const stmt = db.prepare(
    `INSERT INTO duplicate_transactions (id, analysis_id, transaction_id_1, transaction_id_2, match_score, match_reason)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const tx = db.transaction((items) => {
    for (const dup of items) {
      stmt.run(
        `dup-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        analysisId,
        dup.transactionId1,
        dup.transactionId2,
        dup.matchScore || 0.95,
        dup.matchReason || "Identical amount, date, and narration"
      );
    }
  });
  tx(duplicates);
}

function getDuplicateTransactions(analysisId) {
  const rows = db.prepare(
    "SELECT * FROM duplicate_transactions WHERE analysis_id = ? ORDER BY match_score DESC"
  ).all(analysisId);
  return rows.map(row => ({
    id: row.id,
    transactionId1: row.transaction_id_1,
    transactionId2: row.transaction_id_2,
    matchScore: row.match_score,
    matchReason: row.match_reason,
    createdAt: row.created_at,
  }));
}

// Account Mapping Functions
function saveAccountMapping({ clientId, debitAccount, creditAccount, frequency = 1, confidenceScore = 0.8 }) {
  try {
    db.prepare(
      `INSERT INTO account_mappings (id, client_id, debit_account, credit_account, frequency, confidence_score, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).run(
      `amapping-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      clientId,
      debitAccount,
      creditAccount,
      frequency,
      confidenceScore
    );
  } catch (error) {
    if (error.message.includes("UNIQUE constraint failed")) {
      db.prepare(
        `UPDATE account_mappings SET frequency = frequency + 1, confidence_score = ?, updated_at = CURRENT_TIMESTAMP
         WHERE client_id = ? AND debit_account = ? AND credit_account = ?`
      ).run(confidenceScore, clientId, debitAccount, creditAccount);
    }
  }
}

function getAccountMappings(clientId) {
  return db.prepare(
    `SELECT * FROM account_mappings WHERE client_id = ? AND is_active = 1 ORDER BY frequency DESC, updated_at DESC`
  ).all(clientId);
}

function deleteAccountMapping(id) {
  db.prepare("UPDATE account_mappings SET is_active = 0 WHERE id = ?").run(id);
}

// Export Validation Functions
function saveExportValidation({ analysisId, validationType, status, issueCount, issues }) {
  db.prepare(
    `INSERT INTO export_validations (id, analysis_id, validation_type, status, issue_count, issues)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    `val-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    analysisId,
    validationType,
    status,
    issueCount || 0,
    issues ? JSON.stringify(issues) : null
  );
}

function getExportValidations(analysisId) {
  const rows = db.prepare(
    "SELECT * FROM export_validations WHERE analysis_id = ? ORDER BY created_at DESC"
  ).all(analysisId);
  return rows.map(row => ({
    id: row.id,
    validationType: row.validation_type,
    status: row.status,
    issueCount: row.issue_count,
    issues: row.issues ? JSON.parse(row.issues) : [],
    createdAt: row.created_at,
  }));
}

// Analytics Functions
function recordMetric(clientId, analysisId, metricType, metricValue, metricLabel) {
  db.prepare(
    `INSERT INTO processing_analytics (id, client_id, analysis_id, metric_type, metric_value, metric_label)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    `metric-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    clientId,
    analysisId,
    metricType,
    metricValue,
    metricLabel
  );
}

function getAnalytics(clientId, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return db.prepare(
    `SELECT metric_type, COUNT(*) as count, AVG(metric_value) as avg_value
     FROM processing_analytics
     WHERE client_id = ? AND created_at >= ?
     GROUP BY metric_type`
  ).all(clientId, startDate);
}

// Reconciliation Functions
function saveReconciliation({ analysisId, clientId, pushDate, xmlHash, expectedCount, status = "pending" }) {
  db.prepare(
    `INSERT INTO tally_reconciliation (id, analysis_id, client_id, push_date, xml_hash, expected_count, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `recon-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    analysisId,
    clientId,
    pushDate,
    xmlHash,
    expectedCount,
    status
  );
}

function updateReconciliation(id, { receivedCount, matchedEntries, status, mismatches }) {
  db.prepare(
    `UPDATE tally_reconciliation SET received_count = ?, matched_entries = ?, status = ?, mismatches = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(receivedCount, matchedEntries, status, mismatches ? JSON.stringify(mismatches) : null, id);
}

function getReconciliation(analysisId) {
  const row = db.prepare(
    "SELECT * FROM tally_reconciliation WHERE analysis_id = ?"
  ).get(analysisId);
  if (!row) return null;
  return {
    id: row.id,
    analysisId: row.analysis_id,
    clientId: row.client_id,
    pushDate: row.push_date,
    xmlHash: row.xml_hash,
    expectedCount: row.expected_count,
    receivedCount: row.received_count,
    matchedEntries: row.matched_entries,
    status: row.status,
    mismatches: row.mismatches ? JSON.parse(row.mismatches) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// User Assignment Functions
function assignAnalysisToUser(analysisId, userId, assignedBy) {
  db.prepare(
    `INSERT INTO user_assignments (id, analysis_id, user_id, assigned_by, status)
     VALUES (?, ?, ?, ?, 'assigned')`
  ).run(
    `assign-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    analysisId,
    userId,
    assignedBy
  );
}

function getAnalysisAssignees(analysisId) {
  return db.prepare(
    `SELECT ua.*, u.name, u.email FROM user_assignments ua
     LEFT JOIN users u ON u.id = ua.user_id
     WHERE ua.analysis_id = ? AND ua.status = 'assigned'`
  ).all(analysisId);
}

// Audit Log Functions
function recordAuditLog(analysisId, userId, action, changes, ipAddress) {
  db.prepare(
    `INSERT INTO audit_logs (id, analysis_id, user_id, action, changes, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    analysisId,
    userId,
    action,
    changes ? JSON.stringify(changes) : null,
    ipAddress
  );
}

function getAuditLogs(analysisId, limit = 100) {
  return db.prepare(
    `SELECT * FROM audit_logs WHERE analysis_id = ? ORDER BY created_at DESC LIMIT ?`
  ).all(analysisId, limit);
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
  getClientMappingRules,
  saveTransactions,
  updateTransactionClassification,
  upsertMappingRule,
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
  saveTallyLedgers,
  getTallyLedgers,
  saveBankStatementAnalysis,
  getBankStatementAnalysis,
  listBankStatementAnalyses,
  saveBankStatementChange,
  getStatementChangeHistory,
  deleteBankStatementAnalysis,
  saveDuplicateTransactions,
  getDuplicateTransactions,
  saveAccountMapping,
  getAccountMappings,
  deleteAccountMapping,
  saveExportValidation,
  getExportValidations,
  recordMetric,
  getAnalytics,
  saveReconciliation,
  updateReconciliation,
  getReconciliation,
  assignAnalysisToUser,
  getAnalysisAssignees,
  recordAuditLog,
  getAuditLogs,
};
