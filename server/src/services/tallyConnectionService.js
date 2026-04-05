const fs = require("fs");
const path = require("path");
const axios = require("axios");
const AppError = require("../utils/appError");
const { cleanString, toNumber } = require("../utils/normalizers");

const dataDirectory = path.resolve(__dirname, "../data");
const syncStateFile = path.join(dataDirectory, "tally-sync-state.json");

function ensureSyncStateFile() {
  if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
  }

  if (!fs.existsSync(syncStateFile)) {
    fs.writeFileSync(
      syncStateFile,
      JSON.stringify(
        {
          connected: false,
          lastSyncAt: "",
          lastCompanyName: "",
          lastEntryCount: 0,
          lastMessage: "No sync has been run yet.",
        },
        null,
        2
      ),
      "utf8"
    );
  }
}

function readSyncState() {
  ensureSyncStateFile();
  try {
    return JSON.parse(fs.readFileSync(syncStateFile, "utf8"));
  } catch (error) {
    return {
      connected: false,
      lastSyncAt: "",
      lastCompanyName: "",
      lastEntryCount: 0,
      lastMessage: "No sync has been run yet.",
    };
  }
}

function saveSyncState(nextState) {
  ensureSyncStateFile();
  fs.writeFileSync(syncStateFile, JSON.stringify(nextState, null, 2), "utf8");
}

function normalizeTallyConfig(config = {}) {
  return {
    host: cleanString(config.host || config.ip || "localhost"),
    port: String(config.port || 9000),
    companyName: cleanString(config.companyName),
  };
}

function buildBaseUrl(config) {
  const normalized = normalizeTallyConfig(config);
  return `http://${normalized.host}:${normalized.port}`;
}

function buildPingEnvelope(companyName = "") {
  const companyTag = companyName
    ? `<STATICVARIABLES><SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY></STATICVARIABLES>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Companies</REPORTNAME>
        ${companyTag}
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;
}

async function postXmlToTally(config, xml) {
  const normalized = normalizeTallyConfig(config);
  try {
    const response = await axios.post(buildBaseUrl(normalized), xml, {
      headers: {
        "Content-Type": "application/xml",
      },
      timeout: 10000,
      responseType: "text",
    });

    return {
      ...normalized,
      statusCode: response.status,
      body: typeof response.data === "string" ? response.data : JSON.stringify(response.data),
    };
  } catch (error) {
    throw new AppError("Unable to reach TallyPrime on the configured host and port.", 502, {
      cause: error.message,
      config: normalized,
    });
  }
}

async function testTallyConnection(config = {}) {
  const normalized = normalizeTallyConfig(config);
  const result = await postXmlToTally(normalized, buildPingEnvelope(normalized.companyName));
  const nextState = {
    ...readSyncState(),
    connected: true,
    lastMessage: `Connected to ${normalized.host}:${normalized.port}`,
  };
  saveSyncState(nextState);

  return {
    ok: true,
    connected: true,
    config: normalized,
    statusCode: result.statusCode,
    responseSnippet: result.body.slice(0, 280),
    syncState: nextState,
  };
}

function extractImportStats(responseBody = "") {
  const created = toNumber((responseBody.match(/<CREATED>(.*?)<\/CREATED>/i) || [])[1], 0);
  const altered = toNumber((responseBody.match(/<ALTERED>(.*?)<\/ALTERED>/i) || [])[1], 0);
  const ignored = toNumber((responseBody.match(/<IGNORED>(.*?)<\/IGNORED>/i) || [])[1], 0);
  return { created, altered, ignored };
}

async function pushXmlToTally(config = {}, xml, entryCount = 0) {
  if (!cleanString(xml)) {
    throw new AppError("XML payload is required before pushing data to Tally.", 400);
  }

  const normalized = normalizeTallyConfig(config);
  const result = await postXmlToTally(normalized, xml);
  const stats = extractImportStats(result.body);
  const nextState = {
    connected: true,
    lastSyncAt: new Date().toISOString(),
    lastCompanyName: normalized.companyName,
    lastEntryCount: entryCount,
    lastMessage: `Last push returned Created ${stats.created}, Altered ${stats.altered}, Ignored ${stats.ignored}.`,
  };

  saveSyncState(nextState);

  return {
    ok: true,
    config: normalized,
    entryCount,
    tallyStats: stats,
    responseSnippet: result.body.slice(0, 600),
    syncState: nextState,
  };
}

function getTallySyncStatus() {
  const state = readSyncState();
  return {
    connected: Boolean(state.connected),
    lastSyncAt: cleanString(state.lastSyncAt),
    lastCompanyName: cleanString(state.lastCompanyName),
    lastEntryCount: toNumber(state.lastEntryCount, 0),
    lastMessage: cleanString(state.lastMessage),
  };
}

module.exports = {
  getTallySyncStatus,
  normalizeTallyConfig,
  pushXmlToTally,
  testTallyConnection,
};
