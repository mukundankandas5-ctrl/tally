const { XMLParser } = require("fast-xml-parser");
const { getTallyLedgers, saveTallyLedgers } = require("../db/database");
const { fetchLedgersFromUserDevice } = require("./connectorHub");
const { cleanString } = require("../utils/normalizers");

const parser = new XMLParser({
  ignoreAttributes: false,
});

async function syncLedgersForUser(userId, companyName) {
  if (!userId || !companyName) {
    throw new Error("User ID and Company Name are required");
  }

  const rawXml = await fetchLedgersFromUserDevice(userId);
  const data = parser.parse(rawXml);

  const ledgers = [];
  const body = data.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;

  if (Array.isArray(body)) {
    body.forEach((item) => {
      const name = cleanString(item["@_NAME"] || item.NAME);
      const parent = cleanString(item.PARENT);
      if (name) {
        ledgers.push({ name, parent });
      }
    });
  } else if (body) {
    const name = cleanString(body["@_NAME"] || body.NAME);
    const parent = cleanString(body.PARENT);
    if (name) {
      ledgers.push({ name, parent });
    }
  }

  saveTallyLedgers(userId, companyName, ledgers);
  return ledgers;
}

function getAvailableLedgers(userId, companyName) {
  return getTallyLedgers(userId, companyName);
}

module.exports = {
  syncLedgersForUser,
  getAvailableLedgers,
};
