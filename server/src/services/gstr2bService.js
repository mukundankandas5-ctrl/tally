const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const { requestStructuredJson } = require("./anthropicService");

const RECONCILE_SCRIPT  = path.join(__dirname, "../scripts/gstr2b_reconcile.py");
const COLORCODE_SCRIPT  = path.join(__dirname, "../scripts/gstr2b_colorcode.py");
const OUTPUT_DIR        = path.join(__dirname, "../data/tally-ai-gstr2b");
const PYTHON_BIN        = process.env.PYTHON_BIN || "python3";

// ── Download token store  { id → { filePath, filename, expiresAt } } ─────────
const downloadStore = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of downloadStore) {
    if (entry.expiresAt < now) {
      try { fs.unlinkSync(entry.filePath); } catch {}
      downloadStore.delete(id);
    }
  }
}, 15 * 60 * 1000);

// ── Python helpers ─────────────────────────────────────────────────────────────
function _spawnJson(scriptPath, payload) {
  return new Promise((resolve, reject) => {
    const py = spawn(PYTHON_BIN, [scriptPath]);
    let stdout = "", stderr = "";
    py.stdout.on("data", (c) => { stdout += c; });
    py.stderr.on("data", (c) => { stderr += c; });
    py.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`${path.basename(scriptPath)} exited ${code}: ${stderr.slice(0, 600)}`));
      }
      try { resolve(JSON.parse(stdout)); }
      catch { reject(new Error(`${path.basename(scriptPath)}: non-JSON output. stderr: ${stderr.slice(0, 300)}`)); }
    });
    py.on("error", (err) => reject(new Error(`Failed to spawn ${PYTHON_BIN}: ${err.message}`)));
    py.stdin.write(JSON.stringify(payload));
    py.stdin.end();
  });
}

const runReconcile  = (payload) => _spawnJson(RECONCILE_SCRIPT,  payload);
const runColorcode  = (payload) => _spawnJson(COLORCODE_SCRIPT,  payload);

// ── Claude tier-2.5 review ────────────────────────────────────────────────────
async function callClaudeBatch(batch, companyInfo) {
  const systemPrompt = `You are a GST reconciliation expert for Indian CA firms.
Analyse each ambiguous pair (GSTR-2B invoice vs Tally entry candidate) and decide if they match.

Classification rules:
- Match by supplier name in narration when party field is blank (cash/bank entries)
- Consolidated bookings: one Tally entry may cover multiple GSTR-2B invoices
- Amount differences ≤ ₹1 = rounding → treat as matched
- Amount differences ₹1–50 = possible sub-entry rounding → flag for review
- Name variations: LIMITED/LTD, PRIVATE/PVT, AND/& → treat as same supplier
- GSTIN prefix 33 = Tamil Nadu = intra-state = CGST applies
- Jewellery: hallmarking charges may be split; bullion GST rates vary
- Return confidence 1–10: ≥8 matched, 5–7 flag for review, <5 not matched

Return ONLY a JSON object with key "results" containing an array, one object per input entry:
{
  "results": [
    {
      "inv_no": "<invoice number>",
      "match": true/false,
      "confidence": 1-10,
      "tally_ref": "<description of matching Tally entry>",
      "difference": 0.00,
      "reason": "<explanation>",
      "action": "<what CA should do>"
    }
  ]
}`;

  const content = `Company: ${companyInfo.legal_name || companyInfo.trade_name || "Unknown"}
GSTIN: ${companyInfo.gstin || "Unknown"}
Period: ${companyInfo.period || "Unknown"} FY ${companyInfo.fy || "Unknown"}

Reconciliation candidates (${batch.length} entries):
${JSON.stringify(batch, null, 2)}`;

  const parsed = await requestStructuredJson({
    systemPrompt,
    contentBlocks: [{ type: "text", text: content }],
    maxTokens: 4096,
  });

  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.results)) return parsed.results;
  return [];
}

// ── Token helpers ─────────────────────────────────────────────────────────────
function _registerDownload(filePath, filename) {
  const id = uuidv4();
  downloadStore.set(id, { filePath, filename, expiresAt: Date.now() + 30 * 60 * 1000 });
  return id;
}

// ── Main reconciliation ───────────────────────────────────────────────────────
async function reconcileGstr2b(gstr2bBuffer, ledgerBuffers, opts = {}) {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const jobId    = uuidv4();
  const tmpDir   = os.tmpdir();
  const gstrPath = path.join(tmpDir, `gstr2b_${jobId}.xlsx`);
  const cleanDir = path.join(tmpDir, `gstr2b_clean_${jobId}`);
  const colorDir = path.join(OUTPUT_DIR, `color_${jobId}`);

  const { gstr2bName = "GSTR2B.xlsx", ledgerNames = [] } = opts;

  // Write uploaded files to temp disk paths
  fs.writeFileSync(gstrPath, gstr2bBuffer);
  const ldgrPaths = ledgerBuffers.map((buf, i) => {
    const p = path.join(tmpDir, `ledger_${jobId}_${i}.xlsx`);
    fs.writeFileSync(p, buf);
    return p;
  });

  // Tracks all temp paths to clean up at the end
  const tempFiles = [gstrPath, ...ldgrPaths];

  try {
    // ── Step 1: Normalise original ledgers into clean Format-B files ──────────
    // This mirrors what the CLI tool does, ensuring Format A (multi-rate) and
    // Format B (single-ledger) exports are both handled identically to the CLI.
    const normResult = await runColorcode({
      phase:        "normalize",
      ledger_paths: ldgrPaths,
      company:      "Company",
      output_dir:   cleanDir,
    });
    if (normResult.error) throw new Error(`Normalise error: ${normResult.error}`);

    const cleanPaths  = normResult.clean_paths  || [];
    const origToClean = normResult.orig_to_clean || {};
    tempFiles.push(...cleanPaths);

    // ── Step 2: Deterministic matching ───────────────────────────────────────
    const parseResult = await runReconcile({
      phase:        "parse",
      gstr2b_path:  gstrPath,
      ledger_paths: cleanPaths,       // engine reads the normalised files
    });
    if (parseResult.error) throw new Error(`Reconciliation error: ${parseResult.error}`);

    // ── Step 3: Claude tier-2.5 for ambiguous pairs ───────────────────────────
    const tier25       = parseResult.tier2_5_candidates || [];
    const claudeResults = [];
    const companyInfo   = parseResult.company_info || {};

    for (let i = 0; i < tier25.length; i += 50) {
      const batch = tier25.slice(i, i + 50);
      try {
        const batchResult = await callClaudeBatch(batch, companyInfo);
        claudeResults.push(...batchResult);
      } catch (err) {
        console.error(`[gstr2b] Claude batch ${Math.floor(i / 50) + 1} failed: ${err.message}`);
        batch.forEach((candidate) => {
          claudeResults.push({
            inv_no: candidate.inv_no, match: false, confidence: 0,
            tally_ref: "", difference: 0,
            reason: "AI analysis unavailable",
            action: "Review manually — AI service was unavailable",
            fallback: true,
          });
        });
      }
    }

    // ── Step 4: Generate 5-sheet reconciliation report ────────────────────────
    const reportPath = path.join(OUTPUT_DIR, `gstr2b_recon_${jobId}.xlsx`);
    const genResult  = await runReconcile({
      phase:          "generate",
      parse_result:   parseResult,
      claude_results: claudeResults,
      output_path:    reportPath,
    });
    if (genResult.error) throw new Error(`Excel generation error: ${genResult.error}`);

    // ── Step 5: Colour-coded GSTR-2B + colour-coded Tally ledger files ────────
    // Uses the finalised results from step 4 so statuses reflect AI decisions.
    const colorResult = await runColorcode({
      phase:         "colorcode",
      gstr2b_path:   gstrPath,
      ledger_paths:  ldgrPaths,         // original uploaded files (still on disk)
      orig_to_clean: origToClean,
      results:       genResult.entries,
      books_only:    genResult.books_only || [],
      output_dir:    colorDir,
    });
    if (colorResult.error) {
      // Non-fatal: log and continue without colour files
      console.error(`[gstr2b] Colorcode step failed: ${colorResult.error}`);
    }

    // ── Register download tokens (30-min TTL) ─────────────────────────────────
    const reportId = _registerDownload(reportPath, "GSTR2B_Reconciliation.xlsx");

    let color2bUrl = null;
    if (colorResult.color_2b_path && fs.existsSync(colorResult.color_2b_path)) {
      const fn  = gstr2bName.replace(/\.[^.]+$/, "") + "_ColorCoded.xlsx";
      const id  = _registerDownload(colorResult.color_2b_path, fn);
      color2bUrl = `/api/reconcile/download/${id}`;
    }

    const tallyUrls = (colorResult.tally_paths || []).map((tp) => {
      const origName = ledgerNames[tp.index] || tp.original_name;
      const fn       = origName.replace(/\.[^.]+$/, "") + "_Reconciled.xlsx";
      const id       = _registerDownload(tp.path, fn);
      return { url: `/api/reconcile/download/${id}`, filename: fn };
    });

    return {
      status:       "complete",
      summary:      genResult.summary,
      entries:      genResult.entries,
      download_url: `/api/reconcile/download/${reportId}`,
      color_2b_url: color2bUrl,
      tally_urls:   tallyUrls,
      color_warnings: colorResult.warnings || [],
    };

  } finally {
    // Clean up all temp input + clean files (colour output lives in OUTPUT_DIR)
    for (const p of tempFiles) {
      try { fs.unlinkSync(p); } catch {}
    }
    try { fs.rmSync(cleanDir, { recursive: true, force: true }); } catch {}
  }
}

// ── Download token accessors ──────────────────────────────────────────────────
function getDownloadEntry(id) {
  const entry = downloadStore.get(id);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    try { fs.unlinkSync(entry.filePath); } catch {}
    downloadStore.delete(id);
    return null;
  }
  return entry;
}

function deleteDownloadToken(id) {
  downloadStore.delete(id);
}

module.exports = { reconcileGstr2b, getDownloadEntry, deleteDownloadToken };
