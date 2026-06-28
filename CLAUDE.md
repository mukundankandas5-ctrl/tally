# Tally Automation — Claude Code guide

Tally ERP AI Assistant (React + Express + Claude). Runs locally: server `localhost:4000`, client `localhost:5173`. Render deployment is suspended — assume local dev.

---

## GSTR-2B Reconciliation — accountant deliverable (READ FIRST when asked to "reconcile")

When the user asks to **reconcile GSTR-2B / GST / a month's input credit**, the required
output is the **original GSTR-2B workbook reproduced as a near-exact (~99%) copy of the file
downloaded from the GST portal — same sheets, same columns, same rows in the same order — with
the ONLY change being the FONT COLOUR of each invoice's tax figures.** Nothing else changes: no
added columns, no remarks column, no legend, no Summary tab, no re-sorting of rows. The
accountant must be able to open it and see the familiar portal layout, just with the tax numbers
recoloured. A standard 5-sheet report is produced **as a separate file** for the audit trail.

### Tax-figure colour scheme (the only change made to the 2B)

Only the integers in the tax-amount columns (Integrated / Central / State-UT / Cess) are
recoloured, per that invoice row's reconciliation result. Three colours, nothing else:

| Font colour | Means | Definition |
|---|---|---|
| 🟢 **Green** (`008000`) | **Matched** | Invoice found in books, tax agrees (within ₹1) |
| 🟠 **Orange** (`C55A11`) | **Partially matched** | Found in books (same supplier/bill) but the tax amount differs |
| 🔴 **Red** (`FF0000`) | **Unmatched** | Not found in the purchase register (and any credit-note / nil / offset row) |

Note the engine's internal status names differ from this vocabulary — the script maps them:
`matched→green`, engine `unmatched`(=amount differs)→**orange/partial**, `not_in_books`→**red/unmatched**.

### Run this — it does the whole job

```bash
python3 server/src/scripts/gstr2b_colorcode.py \
  --gstr2b "<portal GSTR-2B .xlsx>" \
  --ledger "<Tally IGST input ledger .xlsx>" \
  --ledger "<Tally CGST input ledger .xlsx>" \
  [--ledger "<SGST ledger>" ...] [--outdir DIR] [--company "Legal Name"] \
  [--no-report] [--no-ai] [--model claude-sonnet-4-6] [--api-key sk-...]
```

Outputs (written next to the GSTR-2B, or `--outdir`):
1. `<2B name>_Reconciled_ColorCoded.xlsx` — **primary deliverable.** A faithful copy of the
   government file; only the tax figures on B2B + B2B-CDNR rows are recoloured green/orange/red.
   All other sheets (B2BA / ECO / IMPG / Read me) are copied through untouched.
2. `GSTR2B_Reconciliation_<period>.xlsx` — the engine's 5-sheet report (Summary / Matched /
   Unmatched / Not In Books / Others), the proof trail. Skip with `--no-report`.
3. `<ledger name>_Reconciled.xlsx` (one per `--ledger`) — the original Tally file with
   unmatched entries (not in GSTR-2B) coloured **red** and partially-matched entries (tax
   differs) coloured **orange** on the value cell only; matched rows are unchanged. Cell
   comments explain each flag. These let the accountant chase suppliers directly from the Tally file.

### Client/period identity guard (automatic — important for multi-client work)

Before reconciling, the script resolves the client identity from the GSTR-2B's "Read me" sheet
(legal name, GSTIN) plus the filename (calendar month), prints a `client : <name> | GSTIN … |
period …` line, and **cross-checks it against the Tally ledgers**. It **aborts with a clear
message** (exit non-zero) when:
- the GSTR-2B filename GSTIN/month disagrees with the GSTIN/period inside the file (wrong or
  renamed 2B), or
- a ledger's company header doesn't match the 2B's company (one client's 2B paired with another
  client's ledgers).

This means a mix-up across clients/months is caught even if the prompt forgets to check. Older
2B exports with no "Read me" sheet fall back to the filename and skip the company match (nothing
to compare against). Override a false positive (e.g. a legal-vs-trade-name variation) with
`--force-identity`. Always read the printed `client …` line back to the user.

### Accuracy & the built-in "check twice" (do not skip)

The script verifies itself **twice** and **exits non-zero / prints `VERIFICATION FAILED` if any
check fails — in that case the output is not trustworthy, do NOT deliver it.** The second pass
re-opens the written file independently and confirms:
- it is a **faithful copy** — same sheets, same dimensions, every data cell value identical to
  the source (a row cross-check also guards GSTIN + document number against the matched result);
- every non-zero tax figure carries the **correct status colour**;
- the **green + orange + red tax totals tie out**, per tax head, to the total GSTR-2B tax
  (every 2B line lands in exactly one bucket).

Before handing the file to the user, **also confirm it opens in Apple Numbers** (the user opens
these in Numbers, which is fragile with openpyxl output). The script already builds the file
fresh and runs `make_numbers_compatible()`, but do a final open-test (computer-use → open in
Numbers) on the real deliverable and `xattr -c` the output to strip the macOS quarantine flag.

### Inputs & known quirks the script already handles
- **GSTR-2B**: portal `.xlsx` with a `B2B` sheet (and usually `B2B-CDNR`). The engine reconciles
  both; B2BA/ECO/IMPG/Read me are copied through but not reconciled. Tax columns are located by
  header text, so the layout differences between portal versions are handled automatically.
- **Ledgers**: two Tally export shapes are auto-detected — (A) single-ledger voucher register
  `Date | Particulars(To/By + party) | … | Debit | Credit`, tax type from the title row; and
  (B) flat 3-column `Date | Party | <Input X Tax amount>`. Non-purchase rows (Output*, GST
  Payable, Opening/Closing Balance, Grand Total) are dropped; each ledger is normalised to a
  clean register (unique alpha voucher ids + a constant `Vch Type`) so the engine's dedup keeps
  every distinct invoice and can't false-match blank-supplier 2B rows on amount alone.
- **SGST**: usually only IGST + CGST ledgers are provided; SGST mirrors CGST. Pass an SGST
  ledger if you have one (it's treated as CGST for matching). CGST is counted once.
- Matching is name+amount based when the ledgers carry no bill numbers (these exports don't),
  so "unmatched (red)" is inflated by near-misses — tell the user to confirm before acting.

### How it matches (engine = `server/src/scripts/gstr2b_reconcile.py`)
8 deterministic tiers (GSTIN, name+bill+amount, name+amount, consolidated bookings, etc.).
Ambiguous "tier-2.5" pairs go to Claude (same prompt as the web app's `gstr2bService.js`).
The script resolves the key from `--api-key` → `ANTHROPIC_API_KEY` env → project `.env`; if no
key is found (or `--no-ai`), it uses a deterministic same-supplier rule instead. Claude runs in
batches of 25; any batch that errors or truncates falls back per-entry to the deterministic
rule, so a run never breaks. Model defaults to `claude-sonnet-4-6` (override `--model`).

The web app exposes the same engine at `POST /api/reconcile/gstr2b` and produces **identical
outputs to the CLI** — 5-sheet report + colour-coded GSTR-2B + colour-coded Tally ledger files
(one per uploaded ledger). The service normalises ledgers before matching (Format A/B auto-detect
via `gstr2b_colorcode.py normalize` phase) so colour coding works correctly on both shapes. All
three output types appear as separate download buttons in the UI after reconciliation completes.
Requires a valid `ANTHROPIC_API_KEY` in `server/.env`; falls back to deterministic if unavailable.
