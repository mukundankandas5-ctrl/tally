const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const { requestStructuredJson } = require("./anthropicService");

const SCRIPT_PATH  = path.join(__dirname, "../scripts/gstr2b_reconcile.py");
const OUTPUT_DIR   = path.join(__dirname, "../data/tally-ai-gstr2b");
// On the server, set PYTHON_BIN=/home/ubuntu/tally-ai/venv/bin/python3 in .env
const PYTHON_BIN   = process.env.PYTHON_BIN || "python3";

// In-memory download token store  { id → { filePath, expiresAt } }
const downloadStore = new Map();

// Expire tokens + delete files every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of downloadStore) {
    if (entry.expiresAt < now) {
      try { fs.unlinkSync(entry.filePath); } catch {}
      downloadStore.delete(id);
    }
  }
}, 15 * 60 * 1000);

function runPython(payload) {
  return new Promise((resolve, reject) => {
    const py = spawn(PYTHON_BIN, [SCRIPT_PATH]);
    let stdout = "";
    let stderr = "";

    py.stdout.on("data", (chunk) => { stdout += chunk; });
    py.stderr.on("data", (chunk) => { stderr += chunk; });

    py.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`Python exited ${code}: ${stderr.slice(0, 600)}`));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`Python output was not valid JSON. stderr: ${stderr.slice(0, 300)}`));
      }
    });

    py.on("error", (err) => reject(new Error(`Failed to spawn python3: ${err.message}`)));

    py.stdin.write(JSON.stringify(payload));
    py.stdin.end();
  });
}

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

  // Handle both { results: [...] } and bare array responses
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.results)) return parsed.results;
  return [];
}

async function reconcileGstr2b(gstr2bBuffer, ledgerBuffers) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const jobId    = uuidv4();
  const tmpDir   = os.tmpdir();
  const gstrPath = path.join(tmpDir, `gstr2b_${jobId}.xlsx`);
  const ldgrPaths = ledgerBuffers.map((buf, i) => {
    const p = path.join(tmpDir, `ledger_${jobId}_${i}.xlsx`);
    fs.writeFileSync(p, buf);
    return p;
  });

  fs.writeFileSync(gstrPath, gstr2bBuffer);

  const cleanupInputs = () => {
    try { fs.unlinkSync(gstrPath); } catch {}
    ldgrPaths.forEach((p) => { try { fs.unlinkSync(p); } catch {}; });
  };

  let parseResult;
  try {
    // Phase 1: parse + deterministic matching
    parseResult = await runPython({
      phase:        "parse",
      gstr2b_path:  gstrPath,
      ledger_paths: ldgrPaths,
    });

    if (parseResult.error) {
      throw new Error(`Reconciliation error: ${parseResult.error}`);
    }
  } finally {
    cleanupInputs();
  }

  // Phase 2: Claude for tier 2.5 candidates
  const tier25      = parseResult.tier2_5_candidates || [];
  const claudeResults = [];
  const companyInfo   = parseResult.company_info || {};

  for (let i = 0; i < tier25.length; i += 50) {
    const batch = tier25.slice(i, i + 50);
    try {
      const batchResult = await callClaudeBatch(batch, companyInfo);
      claudeResults.push(...batchResult);
    } catch (err) {
      console.error(`[gstr2b] Claude batch ${Math.floor(i / 50) + 1} failed: ${err.message}`);
      // Fallback: mark all entries in this batch as needing manual review
      batch.forEach((candidate) => {
        claudeResults.push({
          inv_no:     candidate.inv_no,
          match:      false,
          confidence: 0,
          tally_ref:  "",
          difference: 0,
          reason:     "AI analysis unavailable",
          action:     "Review manually — AI service was unavailable",
          fallback:   true,
        });
      });
    }
  }

  // Phase 3: generate Excel report
  const outputPath = path.join(OUTPUT_DIR, `gstr2b_recon_${jobId}.xlsx`);

  const genResult = await runPython({
    phase:         "generate",
    parse_result:  parseResult,
    claude_results: claudeResults,
    output_path:   outputPath,
  });

  if (genResult.error) {
    throw new Error(`Excel generation error: ${genResult.error}`);
  }

  // Store download token (30-minute TTL)
  const downloadId = uuidv4();
  downloadStore.set(downloadId, {
    filePath:  outputPath,
    expiresAt: Date.now() + 30 * 60 * 1000,
  });

  return {
    status:       "complete",
    summary:      genResult.summary,
    entries:      genResult.entries,
    download_url: `/api/reconcile/download/${downloadId}`,
  };
}

function getDownloadPath(id) {
  const entry = downloadStore.get(id);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    try { fs.unlinkSync(entry.filePath); } catch {}
    downloadStore.delete(id);
    return null;
  }
  return entry.filePath;
}

function deleteDownloadToken(id) {
  downloadStore.delete(id);
}

module.exports = { reconcileGstr2b, getDownloadPath, deleteDownloadToken };
